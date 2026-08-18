-- Stage 9.9 — borrar pedidos cancelados (admin). Forward-only.
-- No toca cobros aprobados. No reescribe sale_price.

CREATE OR REPLACE FUNCTION public.delete_cancelled_catalog_orders(p_order_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ids uuid[];
  v_skipped integer := 0;
  v_deleted integer := 0;
  v_pay_ids uuid[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('delete_cancelled_orders', 0));

  IF p_order_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = p_order_id) THEN
      RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id = p_order_id AND o.status = 'cancelled'
    ) THEN
      RAISE EXCEPTION 'order_not_cancelled' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.order_payments p
      WHERE p.order_id = p_order_id
        AND p.status IN ('approved', 'partially_refunded', 'refunded', 'requires_review')
    ) THEN
      RAISE EXCEPTION 'order_has_payment' USING ERRCODE = '23514';
    END IF;
    v_ids := ARRAY[p_order_id];
  ELSE
    SELECT coalesce(array_agg(o.id), ARRAY[]::uuid[])
    INTO v_ids
    FROM public.orders o
    WHERE o.status = 'cancelled'
      AND NOT EXISTS (
        SELECT 1
        FROM public.order_payments p
        WHERE p.order_id = o.id
          AND p.status IN ('approved', 'partially_refunded', 'refunded', 'requires_review')
      );

    SELECT count(*)::integer
    INTO v_skipped
    FROM public.orders o
    WHERE o.status = 'cancelled'
      AND EXISTS (
        SELECT 1
        FROM public.order_payments p
        WHERE p.order_id = o.id
          AND p.status IN ('approved', 'partially_refunded', 'refunded', 'requires_review')
      );
  END IF;

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('deleted_count', 0, 'skipped_count', v_skipped);
  END IF;

  SELECT coalesce(array_agg(p.id), ARRAY[]::uuid[])
  INTO v_pay_ids
  FROM public.order_payments p
  WHERE p.order_id = ANY (v_ids);

  IF v_pay_ids IS NOT NULL AND array_length(v_pay_ids, 1) IS NOT NULL THEN
    DELETE FROM public.payment_events WHERE payment_id = ANY (v_pay_ids);
    DELETE FROM public.payment_access_tokens WHERE payment_id = ANY (v_pay_ids);
    DELETE FROM public.payment_receipts WHERE payment_id = ANY (v_pay_ids);
    DELETE FROM public.order_payments WHERE id = ANY (v_pay_ids);
  END IF;

  DELETE FROM public.payment_access_tokens WHERE order_id = ANY (v_ids);
  DELETE FROM public.shipping_quotes WHERE order_id = ANY (v_ids);

  DELETE FROM public.orders WHERE id = ANY (v_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'deleted_count', v_deleted,
    'skipped_count', v_skipped
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_cancelled_catalog_orders(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_cancelled_catalog_orders(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.delete_cancelled_catalog_orders(uuid) IS
  'Admin: borra pedidos cancelados. Omite los que tienen cobro aprobado o en revisión.';
