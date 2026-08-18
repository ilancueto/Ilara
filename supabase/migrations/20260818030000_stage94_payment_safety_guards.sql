-- Stage 9.4: cierra vías que podrían cambiar el estado interno de un pago sin
-- haber realizado antes la operación monetaria en el proveedor.
-- La operación de reintegro de Mercado Pago sigue siendo exclusiva de la Edge
-- Function, que confirma el reintegro con Mercado Pago antes de registrarlo.

ALTER FUNCTION public.create_order_return(jsonb)
  SET SCHEMA private;

REVOKE ALL ON FUNCTION private.create_order_return(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_order_return(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;

  -- Nunca se registra un reintegro de Mercado Pago desde este RPC. La única
  -- ruta autorizada es la Edge Function payments-mp-refund, después de la
  -- respuesta canónica del proveedor.
  IF coalesce((p_payload->>'apply_payment_refund')::boolean, false) THEN
    RAISE EXCEPTION 'payment_refund_must_be_requested_separately'
      USING ERRCODE = '23514';
  END IF;

  RETURN private.create_order_return(p_payload);
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_return(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_return(jsonb)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.create_order_return(jsonb) IS
  'Crea una devolución de pedido. Los reintegros de Mercado Pago se procesan exclusivamente mediante la ruta que confirma primero con el proveedor.';

CREATE OR REPLACE FUNCTION public.payment_admin_activate_version(p_version_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_row public.payment_pricing_versions%ROWTYPE;
BEGIN
  v_uid := private.payment_pricing_require_admin();
  IF p_version_id IS NULL THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_row
  FROM public.payment_pricing_versions
  WHERE id = p_version_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pricing_version_missing' USING ERRCODE = 'P0002';
  END IF;

  IF (v_row.mercado_pago_enabled OR v_row.bank_transfer_enabled)
     AND NOT v_row.payments_enabled THEN
    RAISE EXCEPTION 'payment_method_requires_payments' USING ERRCODE = '23514';
  END IF;

  IF v_row.payments_enabled
     AND NOT (v_row.mercado_pago_enabled OR v_row.bank_transfer_enabled) THEN
    RAISE EXCEPTION 'payment_methods_required' USING ERRCODE = '23514';
  END IF;

  IF v_row.bank_transfer_enabled
     AND (
       coalesce(nullif(trim(v_row.bank_cbu), ''), nullif(trim(v_row.bank_alias), '')) IS NULL
       OR nullif(trim(v_row.bank_name), '') IS NULL
       OR nullif(trim(v_row.bank_account_holder), '') IS NULL
       OR nullif(trim(v_row.bank_cuit), '') IS NULL
     ) THEN
    RAISE EXCEPTION 'bank_details_required' USING ERRCODE = '23514';
  END IF;

  UPDATE public.payment_pricing_versions
  SET
    status = 'superseded',
    superseded_at = coalesce(superseded_at, now()),
    updated_at = now()
  WHERE status = 'active'
    AND id <> p_version_id;

  UPDATE public.payment_pricing_versions
  SET
    status = 'active',
    activated_by = v_uid,
    activated_at = now(),
    superseded_at = NULL,
    updated_at = now()
  WHERE id = p_version_id
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.payment_admin_activate_version(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payment_admin_activate_version(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.payment_admin_activate_version(uuid) IS
  'Publica una configuración de cobro solo si sus medios y datos de transferencia son coherentes.';
