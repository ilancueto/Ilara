-- =============================================================================
-- Stage 9.2 — margen comercial consolidado (POS + catálogo)
-- =============================================================================
-- Conserva sales_margin_report (6.4) intacto. El costo de pedidos nuevos se
-- snapshotéa al insertar la línea. Históricos quedan como "costo no disponible".

CREATE TABLE IF NOT EXISTS public.order_item_components (
  id bigserial PRIMARY KEY,
  order_item_id bigint NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  product_id integer NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  quantity_per_unit integer NOT NULL CHECK (quantity_per_unit > 0),
  snapshot_source text NOT NULL DEFAULT 'order_time',
  unit_cost numeric(12, 2) CHECK (unit_cost IS NULL OR unit_cost >= 0),
  cost_source text NOT NULL,
  CONSTRAINT order_item_components_unique UNIQUE (order_item_id, product_id),
  CONSTRAINT order_item_components_cost_source_check
    CHECK (cost_source IN ('order_time', 'legacy_current', 'missing'))
);

CREATE INDEX IF NOT EXISTS order_item_components_item_idx
  ON public.order_item_components (order_item_id);
CREATE INDEX IF NOT EXISTS order_item_components_product_idx
  ON public.order_item_components (product_id);

COMMENT ON TABLE public.order_item_components IS
  'Stage 9.2: composición y costo histórico de líneas de pedido. NULL de costo no es cero.';
COMMENT ON COLUMN public.order_item_components.unit_cost IS
  'Costo unitario al momento del pedido. NULL = costo no disponible.';
COMMENT ON COLUMN public.order_item_components.cost_source IS
  'order_time=histórico exacto; missing=sin costo confiable; legacy_current no se usa en backfill de catálogo.';

ALTER TABLE public.order_item_components ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_item_components FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.order_item_components TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.order_item_components_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.snapshot_order_item_components()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    INSERT INTO public.order_item_components (
      order_item_id, product_id, product_name, quantity_per_unit,
      snapshot_source, unit_cost, cost_source
    )
    SELECT
      NEW.id, p.id, p.name, 1, 'order_time', p.purchase_price,
      CASE WHEN p.purchase_price IS NULL THEN 'missing' ELSE 'order_time' END
    FROM public.products p
    WHERE p.id = NEW.product_id
    ON CONFLICT (order_item_id, product_id) DO NOTHING;
  ELSIF NEW.combo_id IS NOT NULL THEN
    INSERT INTO public.order_item_components (
      order_item_id, product_id, product_name, quantity_per_unit,
      snapshot_source, unit_cost, cost_source
    )
    SELECT
      NEW.id, p.id, p.name, ci.quantity, 'order_time', p.purchase_price,
      CASE WHEN p.purchase_price IS NULL THEN 'missing' ELSE 'order_time' END
    FROM public.combo_items ci
    JOIN public.products p ON p.id = ci.product_id
    WHERE ci.combo_id = NEW.combo_id
    ON CONFLICT (order_item_id, product_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.snapshot_order_item_components()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS order_items_snapshot_components ON public.order_items;
CREATE TRIGGER order_items_snapshot_components
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.snapshot_order_item_components();

-- Históricos: composición sí, costo no. No se reinterpreta el pasado.
INSERT INTO public.order_item_components (
  order_item_id, product_id, product_name, quantity_per_unit,
  snapshot_source, unit_cost, cost_source
)
SELECT oi.id, p.id, p.name, 1, 'legacy_product', NULL, 'missing'
FROM public.order_items oi
JOIN public.products p ON p.id = oi.product_id
WHERE oi.product_id IS NOT NULL
ON CONFLICT (order_item_id, product_id) DO NOTHING;

INSERT INTO public.order_item_components (
  order_item_id, product_id, product_name, quantity_per_unit,
  snapshot_source, unit_cost, cost_source
)
SELECT
  oi.id,
  (comp.elem->>'product_id')::integer,
  coalesce(nullif(comp.elem->>'product_name', ''), p.name, 'Producto'),
  greatest(1, coalesce((comp.elem->>'quantity')::integer, 1)),
  'legacy_combo_snapshot',
  NULL,
  'missing'
FROM public.order_items oi
CROSS JOIN LATERAL jsonb_array_elements(coalesce(oi.combo_components_snapshot, '[]'::jsonb)) AS comp(elem)
LEFT JOIN public.products p ON p.id = (comp.elem->>'product_id')::integer
WHERE oi.product_id IS NULL
  AND oi.combo_id IS NOT NULL
  AND (comp.elem->>'product_id') ~ '^[0-9]+$'
ON CONFLICT (order_item_id, product_id) DO NOTHING;

INSERT INTO public.order_item_components (
  order_item_id, product_id, product_name, quantity_per_unit,
  snapshot_source, unit_cost, cost_source
)
SELECT oi.id, p.id, p.name, ci.quantity, 'legacy_current_combo', NULL, 'missing'
FROM public.order_items oi
JOIN public.combo_items ci ON ci.combo_id = oi.combo_id
JOIN public.products p ON p.id = ci.product_id
WHERE oi.product_id IS NULL
  AND oi.combo_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.order_item_components c WHERE c.order_item_id = oi.id
  )
ON CONFLICT (order_item_id, product_id) DO NOTHING;

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
      NULL::bigint AS order_item_id,
      0::integer AS returned_quantity,
      0::numeric AS refund_amount
    WHERE false
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

REVOKE ALL ON FUNCTION public.commercial_margin_report(date, date, text, integer, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commercial_margin_report(date, date, text, integer, integer)
  TO authenticated;

COMMENT ON FUNCTION public.commercial_margin_report(date, date, text, integer, integer) IS
  'Stage 9.2: margen POS + catálogo + combinado. No altera sales_margin_report.';
