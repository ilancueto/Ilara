-- =============================================================================
-- Stage 6.4 — Reportes de margen real
-- =============================================================================
-- Captura costo por componente al vender y expone un único RPC admin-only.
-- Las ventas previas se marcan como estimadas con el costo vigente al migrar.

ALTER TABLE public.sale_item_components
  ADD COLUMN unit_cost numeric(12, 2) CHECK (unit_cost IS NULL OR unit_cost >= 0),
  ADD COLUMN cost_source text;

UPDATE public.sale_item_components sic
SET
  unit_cost = p.purchase_price,
  cost_source = CASE
    WHEN p.purchase_price IS NULL THEN 'missing'
    ELSE 'legacy_current'
  END
FROM public.products p
WHERE p.id = sic.product_id;

UPDATE public.sale_item_components
SET cost_source = 'missing'
WHERE cost_source IS NULL;

ALTER TABLE public.sale_item_components
  ALTER COLUMN cost_source SET NOT NULL,
  ADD CONSTRAINT sale_item_components_cost_source_check
    CHECK (cost_source IN ('sale_time', 'legacy_current', 'missing'));

COMMENT ON COLUMN public.sale_item_components.unit_cost IS
  'Costo unitario del producto físico. NULL significa costo faltante, nunca costo cero.';
COMMENT ON COLUMN public.sale_item_components.cost_source IS
  'sale_time=histórico exacto; legacy_current=estimado al migrar; missing=sin costo confiable.';

CREATE OR REPLACE FUNCTION public.snapshot_sale_item_components()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    INSERT INTO public.sale_item_components (
      sale_item_id, product_id, product_name, quantity_per_unit,
      snapshot_source, unit_cost, cost_source
    )
    SELECT
      NEW.id, p.id, p.name, 1, 'sale_time', p.purchase_price,
      CASE WHEN p.purchase_price IS NULL THEN 'missing' ELSE 'sale_time' END
    FROM public.products p
    WHERE p.id = NEW.product_id
    ON CONFLICT (sale_item_id, product_id) DO NOTHING;
  ELSIF NEW.combo_id IS NOT NULL THEN
    INSERT INTO public.sale_item_components (
      sale_item_id, product_id, product_name, quantity_per_unit,
      snapshot_source, unit_cost, cost_source
    )
    SELECT
      NEW.id, p.id, p.name, ci.quantity, 'sale_time', p.purchase_price,
      CASE WHEN p.purchase_price IS NULL THEN 'missing' ELSE 'sale_time' END
    FROM public.combo_items ci
    JOIN public.products p ON p.id = ci.product_id
    WHERE ci.combo_id = NEW.combo_id
    ON CONFLICT (sale_item_id, product_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.snapshot_sale_item_components()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sales_margin_report(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
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
  v_result jsonb;
BEGIN
  IF v_uid IS NULL OR NOT (SELECT public.is_app_admin()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_from > v_to OR (v_to - v_from) > 730 THEN
    RAISE EXCEPTION 'invalid_margin_report_range' USING ERRCODE = '22023';
  END IF;

  WITH eligible_sales AS (
    SELECT s.id, s.sale_date,
      (s.sale_date AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS sale_day
    FROM public.sales s
    WHERE coalesce(s.status, 'completed') <> 'pending_payment'
      AND (s.sale_date AT TIME ZONE 'America/Argentina/Buenos_Aires')::date BETWEEN v_from AND v_to
  ),
  returned AS (
    SELECT sri.sale_item_id,
      sum(sri.quantity)::integer AS returned_quantity,
      sum(sri.refund_amount)::numeric AS refund_amount
    FROM public.sale_return_items sri
    JOIN public.sale_returns sr ON sr.id = sri.return_id
    GROUP BY sri.sale_item_id
  ),
  component_cost AS (
    SELECT si.id AS sale_item_id,
      count(sic.id) > 0 AND bool_and(sic.unit_cost IS NOT NULL) AS cost_known,
      count(sic.id) > 0 AND bool_or(sic.cost_source = 'legacy_current') AS cost_estimated,
      coalesce(sum(sic.quantity_per_unit * sic.unit_cost), 0)::numeric AS unit_cost
    FROM public.sale_items si
    JOIN eligible_sales es ON es.id = si.sale_id
    LEFT JOIN public.sale_item_components sic ON sic.sale_item_id = si.id
    GROUP BY si.id
  ),
  facts AS (
    SELECT
      es.id AS sale_id,
      es.sale_day,
      si.id AS sale_item_id,
      si.product_id,
      si.combo_id,
      si.product_name,
      si.quantity,
      greatest(0, si.quantity - coalesce(r.returned_quantity, 0))::integer AS net_quantity,
      coalesce(r.returned_quantity, 0)::integer AS returned_quantity,
      (si.unit_price * si.quantity)::numeric AS list_revenue,
      si.subtotal::numeric AS gross_revenue,
      greatest(0, (si.unit_price * si.quantity) - si.subtotal)::numeric AS discount_total,
      coalesce(r.refund_amount, 0)::numeric AS refund_total,
      greatest(0, si.subtotal - coalesce(r.refund_amount, 0))::numeric AS net_revenue,
      cc.cost_known,
      cc.cost_estimated,
      CASE WHEN cc.cost_known
        THEN (cc.unit_cost * greatest(0, si.quantity - coalesce(r.returned_quantity, 0)))::numeric
        ELSE NULL
      END AS net_cogs
    FROM eligible_sales es
    JOIN public.sale_items si ON si.sale_id = es.id
    LEFT JOIN returned r ON r.sale_item_id = si.id
    JOIN component_cost cc ON cc.sale_item_id = si.id
  ),
  summary AS (
    SELECT
      count(DISTINCT sale_id)::bigint AS sale_count,
      coalesce(sum(quantity), 0)::bigint AS units_sold,
      coalesce(sum(returned_quantity), 0)::bigint AS units_returned,
      coalesce(sum(list_revenue), 0)::numeric AS list_revenue,
      coalesce(sum(gross_revenue), 0)::numeric AS gross_revenue,
      coalesce(sum(discount_total), 0)::numeric AS discount_total,
      coalesce(sum(refund_total), 0)::numeric AS refund_total,
      coalesce(sum(net_revenue), 0)::numeric AS net_revenue,
      coalesce(sum(net_cogs) FILTER (WHERE cost_known), 0)::numeric AS known_cogs,
      coalesce(bool_and(cost_known) FILTER (WHERE net_quantity > 0), true) AS margin_complete,
      count(*) FILTER (WHERE net_quantity > 0 AND cost_known AND NOT cost_estimated)::bigint AS exact_lines,
      count(*) FILTER (WHERE net_quantity > 0 AND cost_known AND cost_estimated)::bigint AS estimated_lines,
      count(*) FILTER (WHERE net_quantity > 0 AND NOT cost_known)::bigint AS missing_cost_lines,
      CASE WHEN coalesce(sum(net_revenue), 0) = 0 THEN 100::numeric
        ELSE round(
          100 * coalesce(sum(net_revenue) FILTER (WHERE cost_known), 0)
          / nullif(sum(net_revenue), 0), 2
        )
      END AS cost_coverage_percent
    FROM facts
  ),
  daily_rows AS (
    SELECT sale_day,
      sum(net_revenue)::numeric AS net_revenue,
      sum(net_cogs) FILTER (WHERE cost_known)::numeric AS known_cogs,
      coalesce(bool_and(cost_known) FILTER (WHERE net_quantity > 0), true) AS margin_complete
    FROM facts
    GROUP BY sale_day
  ),
  item_rows AS (
    SELECT
      product_name,
      product_id,
      combo_id,
      sum(net_quantity)::bigint AS net_units,
      sum(net_revenue)::numeric AS net_revenue,
      coalesce(sum(net_cogs) FILTER (WHERE cost_known), 0)::numeric AS known_cogs,
      coalesce(bool_and(cost_known) FILTER (WHERE net_quantity > 0), true) AS margin_complete,
      bool_or(cost_estimated) FILTER (WHERE net_quantity > 0) AS has_estimated_cost
    FROM facts
    GROUP BY product_name, product_id, combo_id
  )
  SELECT jsonb_build_object(
    'from', v_from,
    'to', v_to,
    'summary', jsonb_build_object(
      'sale_count', s.sale_count,
      'units_sold', s.units_sold,
      'units_returned', s.units_returned,
      'list_revenue', s.list_revenue,
      'gross_revenue', s.gross_revenue,
      'discount_total', s.discount_total,
      'refund_total', s.refund_total,
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
      'missing_cost_lines', s.missing_cost_lines
    ),
    'daily', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'date', d.sale_day,
        'net_revenue', d.net_revenue,
        'known_cogs', coalesce(d.known_cogs, 0),
        'gross_margin', CASE WHEN d.margin_complete
          THEN d.net_revenue - coalesce(d.known_cogs, 0) ELSE NULL END,
        'margin_complete', d.margin_complete
      ) ORDER BY d.sale_day)
      FROM daily_rows d
    ), '[]'::jsonb),
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'name', i.product_name,
        'product_id', i.product_id,
        'combo_id', i.combo_id,
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
      ) ORDER BY i.net_revenue DESC, i.product_name)
      FROM (
        SELECT * FROM item_rows
        ORDER BY net_revenue DESC, product_name
        LIMIT 30
      ) i
    ), '[]'::jsonb)
  ) INTO v_result
  FROM summary s;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.sales_margin_report(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sales_margin_report(date, date) TO authenticated;

COMMENT ON FUNCTION public.sales_margin_report(date, date) IS
  'Stage 6.4: margen neto admin-only por fecha de venta; resta devoluciones y reporta calidad del costo.';
