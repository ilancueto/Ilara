-- =============================================================================
-- Stage 9.3 — devoluciones de pedidos de catálogo
-- =============================================================================
-- sale_returns sigue siendo exclusivo de POS. No crea ventas ni toca caja POS.

CREATE TABLE IF NOT EXISTS public.order_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number bigserial NOT NULL UNIQUE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  reason text NOT NULL,
  refund_action text NOT NULL,
  refund_total numeric(12, 2) NOT NULL CHECK (refund_total >= 0),
  restock boolean NOT NULL DEFAULT true,
  order_payment_id uuid REFERENCES public.order_payments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'completed',
  idempotency_key uuid NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_returns_refund_action_check
    CHECK (refund_action IN ('none', 'record_manual', 'request_mp')),
  CONSTRAINT order_returns_status_check
    CHECK (status IN ('completed')),
  CONSTRAINT order_returns_reason_len
    CHECK (char_length(trim(reason)) BETWEEN 3 AND 500)
);

CREATE TABLE IF NOT EXISTS public.order_return_items (
  id bigserial PRIMARY KEY,
  return_id uuid NOT NULL REFERENCES public.order_returns(id) ON DELETE CASCADE,
  order_item_id bigint NOT NULL REFERENCES public.order_items(id),
  product_id integer REFERENCES public.products(id),
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12, 2) NOT NULL CHECK (unit_price >= 0),
  refund_amount numeric(12, 2) NOT NULL CHECK (refund_amount >= 0)
);

CREATE TABLE IF NOT EXISTS public.order_return_events (
  id bigserial PRIMARY KEY,
  return_id uuid NOT NULL REFERENCES public.order_returns(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_returns_order_idx
  ON public.order_returns (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS order_returns_payment_idx
  ON public.order_returns (order_payment_id)
  WHERE order_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS order_return_items_return_idx
  ON public.order_return_items (return_id);
CREATE INDEX IF NOT EXISTS order_return_items_item_idx
  ON public.order_return_items (order_item_id);
CREATE INDEX IF NOT EXISTS order_return_events_return_idx
  ON public.order_return_events (return_id, created_at);

COMMENT ON TABLE public.order_returns IS
  'Devoluciones de pedidos online. No se mezclan con notas de crédito de mostrador.';
COMMENT ON COLUMN public.order_returns.refund_action IS
  'none=solo mercadería; record_manual=reintegro por transferencia ya hecho; request_mp=pedido de reembolso, sin cobro automático.';

ALTER TABLE public.order_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_return_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY order_returns_select_admin
  ON public.order_returns FOR SELECT TO authenticated
  USING ((SELECT public.is_app_admin()));
CREATE POLICY order_return_items_select_admin
  ON public.order_return_items FOR SELECT TO authenticated
  USING ((SELECT public.is_app_admin()));
CREATE POLICY order_return_events_select_admin
  ON public.order_return_events FOR SELECT TO authenticated
  USING ((SELECT public.is_app_admin()));

REVOKE ALL ON TABLE public.order_returns FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.order_return_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.order_return_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.order_returns TO authenticated;
GRANT SELECT ON TABLE public.order_return_items TO authenticated;
GRANT SELECT ON TABLE public.order_return_events TO authenticated;
GRANT ALL ON TABLE public.order_returns, public.order_return_items, public.order_return_events
  TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.order_returns_return_number_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.order_return_items_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.order_return_events_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.create_order_return(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_order_id uuid;
  v_reason text;
  v_refund_action text;
  v_restock boolean;
  v_idempotency_key uuid;
  v_lines jsonb;
  v_payment_id uuid;
  v_apply_refund boolean;
  v_order public.orders%ROWTYPE;
  v_return_id uuid;
  v_return_number bigint;
  v_refund_total numeric(12,2) := 0;
  v_existing jsonb;
  v_line record;
  v_prior_qty integer;
  v_prior_amount numeric(12,2);
  v_available integer;
  v_amount numeric(12,2);
  v_did_restock boolean := false;
BEGIN
  IF v_uid IS NULL OR NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_order_id := (p_payload->>'order_id')::uuid;
    v_idempotency_key := (p_payload->>'idempotency_key')::uuid;
    v_payment_id := nullif(p_payload->>'order_payment_id', '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'invalid_identifiers' USING ERRCODE = '22023';
  END;

  v_reason := trim(coalesce(p_payload->>'reason', ''));
  v_refund_action := trim(coalesce(p_payload->>'refund_action', 'none'));
  v_restock := coalesce((p_payload->>'restock')::boolean, true);
  v_apply_refund := coalesce((p_payload->>'apply_payment_refund')::boolean, false);
  v_lines := p_payload->'lines';

  IF char_length(v_reason) < 3 OR char_length(v_reason) > 500 THEN
    RAISE EXCEPTION 'invalid_reason' USING ERRCODE = '22023';
  END IF;
  IF v_refund_action NOT IN ('none', 'record_manual', 'request_mp') THEN
    RAISE EXCEPTION 'invalid_refund_action' USING ERRCODE = '22023';
  END IF;
  IF v_lines IS NULL OR jsonb_typeof(v_lines) <> 'array'
     OR jsonb_array_length(v_lines) = 0 THEN
    RAISE EXCEPTION 'return_lines_required' USING ERRCODE = '22023';
  END IF;
  IF v_apply_refund AND v_refund_action <> 'request_mp' THEN
    RAISE EXCEPTION 'invalid_refund_action' USING ERRCODE = '22023';
  END IF;

  SELECT jsonb_build_object(
    'id', r.id,
    'return_number', r.return_number,
    'order_id', r.order_id,
    'refund_total', r.refund_total,
    'restock', r.restock,
    'refund_action', r.refund_action,
    'idempotent_replay', true
  )
  INTO v_existing
  FROM public.order_returns r
  WHERE r.idempotency_key = v_idempotency_key;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('stage93:order-return:' || v_order_id::text, 0)
  );

  SELECT * INTO v_order FROM public.orders o WHERE o.id = v_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_order.status NOT IN ('confirmed', 'preparing', 'ready', 'completed') THEN
    RAISE EXCEPTION 'order_not_returnable' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_lines) x(elem)
    GROUP BY elem->>'order_item_id' HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate_return_line' USING ERRCODE = '23514';
  END IF;

  CREATE TEMP TABLE _stage93_lines (
    order_item_id bigint PRIMARY KEY,
    product_id integer,
    product_name text,
    quantity integer,
    unit_price numeric(12,2),
    refund_amount numeric(12,2)
  ) ON COMMIT DROP;

  FOR v_line IN
    SELECT
      oi.id,
      oi.product_id,
      oi.name_snapshot AS product_name,
      oi.quantity,
      oi.unit_price::numeric(12,2) AS unit_price,
      oi.line_subtotal::numeric(12,2) AS subtotal,
      (x.elem->>'quantity')::integer AS requested_qty
    FROM jsonb_array_elements(v_lines) x(elem)
    JOIN public.order_items oi
      ON oi.id = (x.elem->>'order_item_id')::bigint
     AND oi.order_id = v_order_id
    ORDER BY oi.id
    FOR UPDATE OF oi
  LOOP
    IF v_line.requested_qty IS NULL OR v_line.requested_qty <= 0 THEN
      RAISE EXCEPTION 'invalid_return_quantity' USING ERRCODE = '22023';
    END IF;
    SELECT coalesce(sum(ri.quantity), 0), coalesce(sum(ri.refund_amount), 0)
      INTO v_prior_qty, v_prior_amount
    FROM public.order_return_items ri
    JOIN public.order_returns r ON r.id = ri.return_id
    WHERE ri.order_item_id = v_line.id AND r.status = 'completed';

    v_available := v_line.quantity - v_prior_qty;
    IF v_line.requested_qty > v_available THEN
      RAISE EXCEPTION 'return_quantity_exceeds_available' USING ERRCODE = '23514';
    END IF;
    IF v_line.requested_qty = v_available THEN
      v_amount := v_line.subtotal - v_prior_amount;
    ELSE
      v_amount := round(v_line.subtotal * v_line.requested_qty / v_line.quantity, 2);
    END IF;
    IF v_amount < 0 THEN
      RAISE EXCEPTION 'invalid_refund_amount' USING ERRCODE = '23514';
    END IF;
    INSERT INTO _stage93_lines VALUES (
      v_line.id, v_line.product_id, v_line.product_name,
      v_line.requested_qty, v_line.unit_price, v_amount
    );
    v_refund_total := v_refund_total + v_amount;
  END LOOP;

  IF (SELECT count(*) FROM _stage93_lines) <> jsonb_array_length(v_lines) THEN
    RAISE EXCEPTION 'order_item_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_refund_total > v_order.total THEN
    RAISE EXCEPTION 'invalid_refund_total' USING ERRCODE = '23514';
  END IF;

  IF v_payment_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.order_payments p
      WHERE p.id = v_payment_id AND p.order_id = v_order_id
    ) THEN
      RAISE EXCEPTION 'payment_not_found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF v_restock AND NOT v_order.stock_reserved THEN
    RAISE EXCEPTION 'stock_not_reserved' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.order_returns (
    order_id, reason, refund_action, refund_total, restock,
    order_payment_id, idempotency_key, created_by
  ) VALUES (
    v_order_id, v_reason, v_refund_action, v_refund_total, v_restock,
    v_payment_id, v_idempotency_key, v_uid
  ) RETURNING id, return_number INTO v_return_id, v_return_number;

  INSERT INTO public.order_return_items (
    return_id, order_item_id, product_id, product_name,
    quantity, unit_price, refund_amount
  )
  SELECT v_return_id, order_item_id, product_id, product_name,
    quantity, unit_price, refund_amount
  FROM _stage93_lines;

  IF v_restock THEN
    IF EXISTS (
      SELECT 1
      FROM _stage93_lines l
      LEFT JOIN public.order_item_components c ON c.order_item_id = l.order_item_id
      GROUP BY l.order_item_id
      HAVING count(c.id) = 0
    ) THEN
      RAISE EXCEPTION 'missing_component_snapshot' USING ERRCODE = '23514';
    END IF;

    WITH restored AS (
      SELECT c.product_id, sum(c.quantity_per_unit * l.quantity)::integer AS qty
      FROM _stage93_lines l
      JOIN public.order_item_components c ON c.order_item_id = l.order_item_id
      WHERE c.product_id IS NOT NULL
      GROUP BY c.product_id
    )
    UPDATE public.products p
    SET stock = p.stock + restored.qty
    FROM restored WHERE p.id = restored.product_id;

    INSERT INTO public.stock_movements (
      product_id, type, quantity, reference_type, reference_id, notes, user_id
    )
    SELECT c.product_id, 'adjustment',
      sum(c.quantity_per_unit * l.quantity)::integer,
      'order_return', v_return_number,
      'Devolución pedido ' || v_order.order_number,
      v_uid
    FROM _stage93_lines l
    JOIN public.order_item_components c ON c.order_item_id = l.order_item_id
    WHERE c.product_id IS NOT NULL
    GROUP BY c.product_id;

    v_did_restock := true;
  END IF;

  INSERT INTO public.order_return_events (
    return_id, event_type, actor_user_id, meta
  ) VALUES (
    v_return_id, 'created', v_uid,
    jsonb_build_object(
      'order_id', v_order_id,
      'refund_total', v_refund_total,
      'refund_action', v_refund_action,
      'restock', v_did_restock,
      'line_count', (SELECT count(*) FROM _stage93_lines)
    )
  );

  IF v_apply_refund THEN
    IF v_payment_id IS NULL THEN
      RAISE EXCEPTION 'payment_not_found' USING ERRCODE = 'P0002';
    END IF;
    PERFORM public.admin_refund_catalog_payment(
      v_payment_id,
      v_refund_total,
      v_reason
    );
    INSERT INTO public.order_return_events (
      return_id, event_type, actor_user_id, meta
    ) VALUES (
      v_return_id, 'payment_refund_recorded', v_uid,
      jsonb_build_object('order_payment_id', v_payment_id, 'amount', v_refund_total)
    );
  ELSIF v_refund_action = 'record_manual' THEN
    INSERT INTO public.order_return_events (
      return_id, event_type, actor_user_id, meta
    ) VALUES (
      v_return_id, 'manual_refund_recorded', v_uid,
      jsonb_build_object('amount', v_refund_total)
    );
  END IF;

  RETURN jsonb_build_object(
    'id', v_return_id,
    'return_number', v_return_number,
    'order_id', v_order_id,
    'refund_total', v_refund_total,
    'restock', v_did_restock,
    'refund_action', v_refund_action,
    'idempotent_replay', false
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT jsonb_build_object(
      'id', r.id,
      'return_number', r.return_number,
      'order_id', r.order_id,
      'refund_total', r.refund_total,
      'restock', r.restock,
      'refund_action', r.refund_action,
      'idempotent_replay', true
    ) INTO v_existing
    FROM public.order_returns r WHERE r.idempotency_key = v_idempotency_key;
    IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_return(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_return(jsonb)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.create_order_return(jsonb) IS
  'Stage 9.3: devolución de pedido online. No crea venta POS ni reintegra dinero salvo acción explícita.';

-- Recalcula margen catálogo restando devoluciones físicas.
CREATE OR REPLACE FUNCTION public.commercial_margin_report(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_channel text DEFAULT 'combined',
  p_product_id integer DEFAULT NULL,
  p_category_id integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_from date := coalesce(p_from, date_trunc('month', now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date);
  v_to date := coalesce(p_to, (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date);
  v_channel text := lower(coalesce(nullif(trim(p_channel), ''), 'combined'));
  v_pos jsonb;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL OR NOT (SELECT public.is_app_admin()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_from > v_to OR (v_to - v_from) > 730 THEN
    RAISE EXCEPTION 'invalid_margin_report_range' USING ERRCODE = '22023';
  END IF;
  IF v_channel NOT IN ('pos', 'catalog', 'combined') THEN
    RAISE EXCEPTION 'invalid_margin_channel' USING ERRCODE = '22023';
  END IF;

  v_pos := public.sales_margin_report(v_from, v_to);

  WITH eligible_orders AS (
    SELECT
      o.id,
      o.order_number,
      o.subtotal,
      o.discount_total,
      o.shipping_amount,
      o.total,
      o.created_at,
      (o.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS order_day
    FROM public.orders o
    WHERE o.status IN ('confirmed', 'preparing', 'ready', 'completed')
      AND (o.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN v_from AND v_to
  ),
  pay AS (
    SELECT DISTINCT ON (op.order_id)
      op.order_id,
      coalesce(op.estimated_fee, 0)::numeric AS estimated_fee,
      coalesce(op.actual_fee, 0)::numeric AS actual_fee,
      coalesce(op.refunded_amount, 0)::numeric AS payment_refund
    FROM public.order_payments op
    JOIN eligible_orders eo ON eo.id = op.order_id
    ORDER BY op.order_id, op.created_at DESC
  ),
  returned AS (
    SELECT
      ori.order_item_id,
      sum(ori.quantity)::integer AS returned_quantity,
      sum(ori.refund_amount)::numeric AS refund_amount
    FROM public.order_return_items ori
    JOIN public.order_returns r ON r.id = ori.return_id
    WHERE r.status = 'completed'
    GROUP BY ori.order_item_id
  ),
  component_cost AS (
    SELECT
      oi.id AS order_item_id,
      count(c.id) > 0 AND bool_and(c.unit_cost IS NOT NULL) AS cost_known,
      count(c.id) > 0 AND bool_or(c.cost_source = 'legacy_current') AS cost_estimated,
      coalesce(sum(c.quantity_per_unit * c.unit_cost), 0)::numeric AS unit_cost
    FROM public.order_items oi
    JOIN eligible_orders eo ON eo.id = oi.order_id
    LEFT JOIN public.order_item_components c ON c.order_item_id = oi.id
    GROUP BY oi.id
  ),
  facts AS (
    SELECT
      eo.id AS order_id,
      eo.order_number,
      eo.order_day,
      oi.id AS order_item_id,
      oi.product_id,
      oi.combo_id,
      oi.name_snapshot AS product_name,
      oi.quantity,
      greatest(0, oi.quantity - coalesce(r.returned_quantity, 0))::integer AS net_quantity,
      coalesce(r.returned_quantity, 0)::integer AS returned_quantity,
      oi.line_subtotal::numeric AS gross_revenue,
      CASE
        WHEN oi.quantity > 0 AND oi.discount_percentage > 0
          THEN round(oi.line_subtotal * oi.discount_percentage / (100 - oi.discount_percentage), 2)
        ELSE 0
      END AS discount_total,
      coalesce(r.refund_amount, 0)::numeric AS refund_total,
      greatest(0, oi.line_subtotal - coalesce(r.refund_amount, 0))::numeric AS net_revenue,
      cc.cost_known,
      cc.cost_estimated,
      CASE WHEN cc.cost_known
        THEN (cc.unit_cost * greatest(0, oi.quantity - coalesce(r.returned_quantity, 0)))::numeric
        ELSE NULL
      END AS net_cogs,
      p.category_id
    FROM eligible_orders eo
    JOIN public.order_items oi ON oi.order_id = eo.id
    LEFT JOIN returned r ON r.order_item_id = oi.id
    JOIN component_cost cc ON cc.order_item_id = oi.id
    LEFT JOIN public.products p ON p.id = oi.product_id
    WHERE (p_product_id IS NULL
      OR oi.product_id = p_product_id
      OR EXISTS (
        SELECT 1 FROM public.order_item_components c
        WHERE c.order_item_id = oi.id AND c.product_id = p_product_id
      ))
      AND (p_category_id IS NULL
        OR p.category_id = p_category_id
        OR EXISTS (
          SELECT 1
          FROM public.order_item_components c
          JOIN public.products cp ON cp.id = c.product_id
          WHERE c.order_item_id = oi.id AND cp.category_id = p_category_id
        ))
  ),
  order_roll AS (
    SELECT
      eo.id,
      eo.order_number,
      eo.order_day,
      eo.subtotal,
      eo.discount_total,
      eo.shipping_amount,
      eo.total,
      coalesce(pay.estimated_fee, 0) AS estimated_fee,
      coalesce(pay.actual_fee, 0) AS actual_fee,
      coalesce(pay.payment_refund, 0) AS payment_refund,
      coalesce(sum(f.refund_total), 0) AS merchandise_refund,
      coalesce(bool_and(f.cost_known) FILTER (WHERE f.net_quantity > 0), true) AS cost_known,
      count(*) FILTER (WHERE f.net_quantity > 0 AND NOT f.cost_known)::bigint AS missing_lines
    FROM eligible_orders eo
    LEFT JOIN pay ON pay.order_id = eo.id
    LEFT JOIN facts f ON f.order_id = eo.id
    GROUP BY eo.id, eo.order_number, eo.order_day, eo.subtotal, eo.discount_total,
      eo.shipping_amount, eo.total, pay.estimated_fee, pay.actual_fee, pay.payment_refund
  ),
  catalog_summary AS (
    SELECT
      count(DISTINCT f.order_id)::bigint AS order_count,
      coalesce(sum(f.quantity), 0)::bigint AS units_sold,
      coalesce(sum(f.returned_quantity), 0)::bigint AS units_returned,
      coalesce(sum(f.gross_revenue), 0)::numeric AS subtotal,
      coalesce(sum(f.discount_total), 0)::numeric AS discount_total,
      coalesce((SELECT sum(shipping_amount) FROM order_roll), 0)::numeric AS shipping_charged,
      coalesce((SELECT sum(estimated_fee) FROM order_roll), 0)::numeric AS estimated_fee,
      coalesce((SELECT sum(actual_fee) FROM order_roll), 0)::numeric AS actual_fee,
      coalesce((SELECT sum(merchandise_refund) FROM order_roll), 0)::numeric AS refund_total,
      coalesce((SELECT sum(payment_refund) FROM order_roll), 0)::numeric AS payment_refund,
      coalesce(sum(f.net_revenue), 0)::numeric AS net_revenue,
      coalesce(sum(f.net_cogs) FILTER (WHERE f.cost_known), 0)::numeric AS known_cogs,
      coalesce(bool_and(f.cost_known) FILTER (WHERE f.net_quantity > 0), true) AS margin_complete,
      count(*) FILTER (WHERE f.net_quantity > 0 AND f.cost_known AND NOT f.cost_estimated)::bigint AS exact_lines,
      count(*) FILTER (WHERE f.net_quantity > 0 AND f.cost_known AND f.cost_estimated)::bigint AS estimated_lines,
      count(*) FILTER (WHERE f.net_quantity > 0 AND NOT f.cost_known)::bigint AS missing_cost_lines,
      (SELECT count(*) FROM order_roll WHERE missing_lines > 0)::bigint AS missing_cost_orders,
      CASE WHEN coalesce(sum(f.net_revenue), 0) = 0 THEN 100::numeric
        ELSE round(
          100 * coalesce(sum(f.net_revenue) FILTER (WHERE f.cost_known), 0)
          / nullif(sum(f.net_revenue), 0), 2
        )
      END AS cost_coverage_percent
    FROM facts f
  ),
  catalog_daily AS (
    SELECT
      order_day AS date,
      sum(net_revenue)::numeric AS net_revenue,
      sum(net_cogs) FILTER (WHERE cost_known)::numeric AS known_cogs,
      coalesce(bool_and(cost_known) FILTER (WHERE net_quantity > 0), true) AS margin_complete
    FROM facts
    GROUP BY order_day
  ),
  catalog_items AS (
    SELECT
      product_name AS name,
      product_id,
      combo_id,
      sum(net_quantity)::bigint AS net_units,
      sum(net_revenue)::numeric AS net_revenue,
      coalesce(sum(net_cogs) FILTER (WHERE cost_known), 0)::numeric AS known_cogs,
      coalesce(bool_and(cost_known) FILTER (WHERE net_quantity > 0), true) AS margin_complete,
      bool_or(cost_estimated) FILTER (WHERE net_quantity > 0) AS has_estimated_cost
    FROM facts
    GROUP BY product_name, product_id, combo_id
  ),
  catalog_obj AS (
    SELECT jsonb_build_object(
      'sale_count', s.order_count,
      'order_count', s.order_count,
      'units_sold', s.units_sold,
      'units_returned', s.units_returned,
      'list_revenue', s.subtotal,
      'gross_revenue', s.subtotal,
      'subtotal', s.subtotal,
      'discount_total', s.discount_total,
      'shipping_charged', s.shipping_charged,
      'estimated_fee', s.estimated_fee,
      'actual_fee', s.actual_fee,
      'refund_total', s.refund_total,
      'payment_refund', s.payment_refund,
      'net_revenue', s.net_revenue,
      'known_cogs', s.known_cogs,
      'gross_margin', CASE WHEN s.margin_complete THEN s.net_revenue - s.known_cogs ELSE NULL END,
      'margin_percent', CASE
        WHEN s.margin_complete AND s.net_revenue <> 0
          THEN round(100 * (s.net_revenue - s.known_cogs) / s.net_revenue, 2)
        ELSE NULL
      END,
      'margin_complete', s.margin_complete,
      'cost_coverage_percent', s.cost_coverage_percent,
      'exact_lines', s.exact_lines,
      'estimated_lines', s.estimated_lines,
      'missing_cost_lines', s.missing_cost_lines,
      'missing_cost_orders', s.missing_cost_orders
    ) AS obj
    FROM catalog_summary s
  ),
  pending_orders AS (
    SELECT coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'order_number', r.order_number,
        'created_at', (
          SELECT o.created_at FROM public.orders o WHERE o.id = r.id
        )
      ) ORDER BY r.order_number)
      FROM (SELECT id, order_number FROM order_roll WHERE missing_lines > 0 LIMIT 30) r
    ), '[]'::jsonb) AS obj
  )
  SELECT jsonb_build_object(
    'from', v_from,
    'to', v_to,
    'channel', v_channel,
    'pos', v_pos -> 'summary',
    'catalog', c.obj,
    'combined', jsonb_build_object(
      'sale_count', coalesce((v_pos #>> '{summary,sale_count}')::numeric, 0)
        + coalesce((c.obj->>'sale_count')::numeric, 0),
      'units_sold', coalesce((v_pos #>> '{summary,units_sold}')::numeric, 0)
        + coalesce((c.obj->>'units_sold')::numeric, 0),
      'units_returned', coalesce((v_pos #>> '{summary,units_returned}')::numeric, 0)
        + coalesce((c.obj->>'units_returned')::numeric, 0),
      'list_revenue', coalesce((v_pos #>> '{summary,list_revenue}')::numeric, 0)
        + coalesce((c.obj->>'list_revenue')::numeric, 0),
      'gross_revenue', coalesce((v_pos #>> '{summary,gross_revenue}')::numeric, 0)
        + coalesce((c.obj->>'gross_revenue')::numeric, 0),
      'discount_total', coalesce((v_pos #>> '{summary,discount_total}')::numeric, 0)
        + coalesce((c.obj->>'discount_total')::numeric, 0),
      'refund_total', coalesce((v_pos #>> '{summary,refund_total}')::numeric, 0)
        + coalesce((c.obj->>'refund_total')::numeric, 0),
      'net_revenue', coalesce((v_pos #>> '{summary,net_revenue}')::numeric, 0)
        + coalesce((c.obj->>'net_revenue')::numeric, 0),
      'known_cogs', coalesce((v_pos #>> '{summary,known_cogs}')::numeric, 0)
        + coalesce((c.obj->>'known_cogs')::numeric, 0),
      'gross_margin', CASE
        WHEN coalesce((v_pos #>> '{summary,margin_complete}')::boolean, true)
          AND coalesce((c.obj->>'margin_complete')::boolean, true)
        THEN coalesce((v_pos #>> '{summary,net_revenue}')::numeric, 0)
          + coalesce((c.obj->>'net_revenue')::numeric, 0)
          - coalesce((v_pos #>> '{summary,known_cogs}')::numeric, 0)
          - coalesce((c.obj->>'known_cogs')::numeric, 0)
        ELSE NULL
      END,
      'margin_percent', CASE
        WHEN coalesce((v_pos #>> '{summary,margin_complete}')::boolean, true)
          AND coalesce((c.obj->>'margin_complete')::boolean, true)
          AND (
            coalesce((v_pos #>> '{summary,net_revenue}')::numeric, 0)
            + coalesce((c.obj->>'net_revenue')::numeric, 0)
          ) <> 0
        THEN round(100 * (
          coalesce((v_pos #>> '{summary,net_revenue}')::numeric, 0)
          + coalesce((c.obj->>'net_revenue')::numeric, 0)
          - coalesce((v_pos #>> '{summary,known_cogs}')::numeric, 0)
          - coalesce((c.obj->>'known_cogs')::numeric, 0)
        ) / (
          coalesce((v_pos #>> '{summary,net_revenue}')::numeric, 0)
          + coalesce((c.obj->>'net_revenue')::numeric, 0)
        ), 2)
        ELSE NULL
      END,
      'margin_complete',
        coalesce((v_pos #>> '{summary,margin_complete}')::boolean, true)
        AND coalesce((c.obj->>'margin_complete')::boolean, true),
      'cost_coverage_percent', CASE
        WHEN (
          coalesce((v_pos #>> '{summary,net_revenue}')::numeric, 0)
          + coalesce((c.obj->>'net_revenue')::numeric, 0)
        ) = 0 THEN 100::numeric
        ELSE round(100 * (
          coalesce((v_pos #>> '{summary,net_revenue}')::numeric, 0)
            * coalesce((v_pos #>> '{summary,cost_coverage_percent}')::numeric, 0) / 100
          + coalesce((c.obj->>'net_revenue')::numeric, 0)
            * coalesce((c.obj->>'cost_coverage_percent')::numeric, 0) / 100
        ) / (
          coalesce((v_pos #>> '{summary,net_revenue}')::numeric, 0)
          + coalesce((c.obj->>'net_revenue')::numeric, 0)
        ), 2)
      END,
      'exact_lines', coalesce((v_pos #>> '{summary,exact_lines}')::numeric, 0)
        + coalesce((c.obj->>'exact_lines')::numeric, 0),
      'estimated_lines', coalesce((v_pos #>> '{summary,estimated_lines}')::numeric, 0)
        + coalesce((c.obj->>'estimated_lines')::numeric, 0),
      'missing_cost_lines', coalesce((v_pos #>> '{summary,missing_cost_lines}')::numeric, 0)
        + coalesce((c.obj->>'missing_cost_lines')::numeric, 0)
    ),
    'pending_cost_orders', po.obj,
    'daily', CASE v_channel
      WHEN 'pos' THEN coalesce(v_pos -> 'daily', '[]'::jsonb)
      WHEN 'catalog' THEN coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'date', d.date,
          'net_revenue', d.net_revenue,
          'known_cogs', coalesce(d.known_cogs, 0),
          'gross_margin', CASE WHEN d.margin_complete
            THEN d.net_revenue - coalesce(d.known_cogs, 0) ELSE NULL END,
          'margin_complete', d.margin_complete
        ) ORDER BY d.date)
        FROM catalog_daily d
      ), '[]'::jsonb)
      ELSE coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'date', x.date,
          'net_revenue', x.net_revenue,
          'known_cogs', x.known_cogs,
          'gross_margin', CASE WHEN x.margin_complete
            THEN x.net_revenue - x.known_cogs ELSE NULL END,
          'margin_complete', x.margin_complete
        ) ORDER BY x.date)
        FROM (
          SELECT
            coalesce(p.date, c.date) AS date,
            coalesce(p.net_revenue, 0) + coalesce(c.net_revenue, 0) AS net_revenue,
            coalesce(p.known_cogs, 0) + coalesce(c.known_cogs, 0) AS known_cogs,
            coalesce(p.margin_complete, true) AND coalesce(c.margin_complete, true) AS margin_complete
          FROM (
            SELECT (e->>'date')::date AS date,
              (e->>'net_revenue')::numeric AS net_revenue,
              (e->>'known_cogs')::numeric AS known_cogs,
              (e->>'margin_complete')::boolean AS margin_complete
            FROM jsonb_array_elements(coalesce(v_pos -> 'daily', '[]'::jsonb)) e
          ) p
          FULL JOIN catalog_daily c ON c.date = p.date
        ) x
      ), '[]'::jsonb)
    END,
    'items', CASE v_channel
      WHEN 'pos' THEN coalesce(v_pos -> 'items', '[]'::jsonb)
      WHEN 'catalog' THEN coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'name', i.name,
          'product_id', i.product_id,
          'combo_id', i.combo_id,
          'channel', 'catalog',
          'net_units', i.net_units,
          'net_revenue', i.net_revenue,
          'known_cogs', i.known_cogs,
          'gross_margin', CASE WHEN i.margin_complete
            THEN i.net_revenue - i.known_cogs ELSE NULL END,
          'margin_percent', CASE
            WHEN i.margin_complete AND i.net_revenue <> 0
              THEN round(100 * (i.net_revenue - i.known_cogs) / i.net_revenue, 2)
            ELSE NULL
          END,
          'margin_complete', i.margin_complete,
          'has_estimated_cost', coalesce(i.has_estimated_cost, false)
        ) ORDER BY i.net_revenue DESC, i.name)
        FROM (
          SELECT * FROM catalog_items ORDER BY net_revenue DESC, name LIMIT 30
        ) i
      ), '[]'::jsonb)
      ELSE coalesce((
        SELECT jsonb_agg(item ORDER BY (item->>'net_revenue')::numeric DESC)
        FROM (
          SELECT e || jsonb_build_object('channel', 'pos') AS item
          FROM jsonb_array_elements(coalesce(v_pos -> 'items', '[]'::jsonb)) e
          UNION ALL
          SELECT jsonb_build_object(
            'name', i.name,
            'product_id', i.product_id,
            'combo_id', i.combo_id,
            'channel', 'catalog',
            'net_units', i.net_units,
            'net_revenue', i.net_revenue,
            'known_cogs', i.known_cogs,
            'gross_margin', CASE WHEN i.margin_complete
              THEN i.net_revenue - i.known_cogs ELSE NULL END,
            'margin_percent', CASE
              WHEN i.margin_complete AND i.net_revenue <> 0
                THEN round(100 * (i.net_revenue - i.known_cogs) / i.net_revenue, 2)
              ELSE NULL
            END,
            'margin_complete', i.margin_complete,
            'has_estimated_cost', coalesce(i.has_estimated_cost, false)
          )
          FROM catalog_items i
          LIMIT 30
        ) u
      ), '[]'::jsonb)
    END
  ) INTO v_result
  FROM catalog_obj c
  CROSS JOIN pending_orders po;

  IF v_channel = 'pos' THEN
    v_result := v_result || jsonb_build_object('summary', v_pos -> 'summary');
  ELSIF v_channel = 'catalog' THEN
    v_result := v_result || jsonb_build_object('summary', v_result -> 'catalog');
  ELSE
    v_result := v_result || jsonb_build_object('summary', v_result -> 'combined');
  END IF;

  RETURN v_result;
END;
$$;
