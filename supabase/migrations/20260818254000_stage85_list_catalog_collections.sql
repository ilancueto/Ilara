-- Listado simple de cobros de catálogo para el panel.
-- No pasa por el corte de CxC. Forward-only.

CREATE OR REPLACE FUNCTION public.admin_list_catalog_collections(
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
  v_from date := coalesce(p_from, DATE '2016-01-01');
  v_to date := coalesce(p_to, (timezone('America/Argentina/Buenos_Aires', now()))::date);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
  IF v_from > v_to THEN
    RAISE EXCEPTION 'invalid_finance_period' USING ERRCODE = '22023';
  END IF;

  RETURN coalesce((
    SELECT jsonb_build_object(
      'total', coalesce(sum(q.amount_due), 0),
      'count', count(*)::integer,
      'items', coalesce(jsonb_agg(q.item ORDER BY q.sort_at DESC), '[]'::jsonb)
    )
    FROM (
      SELECT
        p.amount_due,
        coalesce(p.approved_at, p.created_at) AS sort_at,
        jsonb_build_object(
          'id', p.id,
          'order_number', o.order_number,
          'customer_name', o.customer_name,
          'method', p.method,
          'status', p.status,
          'amount_due', p.amount_due,
          'approved_at', p.approved_at,
          'created_at', p.created_at
        ) AS item
      FROM public.order_payments p
      JOIN public.orders o ON o.id = p.order_id
      WHERE p.status IN ('approved', 'partially_refunded', 'refunded')
        AND (timezone('America/Argentina/Buenos_Aires', coalesce(p.approved_at, p.created_at)))::date
          BETWEEN v_from AND v_to
    ) q
  ), jsonb_build_object('total', 0, 'count', 0, 'items', '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_catalog_collections(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_catalog_collections(date, date)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.admin_list_catalog_collections(date, date) IS
  'Admin: cobros de catálogo aprobados para tablero e ingresos.';
