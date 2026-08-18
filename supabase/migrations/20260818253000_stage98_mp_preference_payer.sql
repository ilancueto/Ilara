-- Stage 9.8b — datos del comprador en la preferencia de Mercado Pago.
-- Forward-only. No toca flags ni sale_price.

CREATE OR REPLACE FUNCTION public.mp_preference_context(p_access_capability text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_id uuid;
  v_order public.orders%ROWTYPE;
  v_pay public.order_payments%ROWTYPE;
BEGIN
  v_order_id := private.resolve_order_access(p_access_capability);
  SELECT * INTO v_order FROM public.orders WHERE id = v_order_id;
  SELECT * INTO v_pay
  FROM public.order_payments
  WHERE order_id = v_order_id
  ORDER BY created_at DESC
  LIMIT 1;
  IF NOT FOUND OR v_pay.method <> 'mercado_pago' THEN
    RAISE EXCEPTION 'invalid_payment_method' USING ERRCODE = '23514';
  END IF;
  RETURN jsonb_build_object(
    'payment_id', v_pay.id,
    'order_number', v_order.order_number,
    'status', v_pay.status,
    'amount_due', v_pay.amount_due,
    'currency', v_pay.currency,
    'idempotency_key', v_pay.idempotency_key,
    'external_reference', v_pay.external_reference,
    'expires_at', v_pay.expires_at,
    'preference_id', v_pay.provider_preference_id,
    'checkout_url', v_pay.provider_checkout_url,
    'customer_email', v_order.customer_email,
    'customer_name', v_order.customer_name,
    'customer_phone', v_order.customer_phone
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mp_preference_context(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mp_preference_context(text)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mp_preference_context_follow(
  p_order_number text,
  p_follow_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_id uuid;
  v_order public.orders%ROWTYPE;
  v_pay public.order_payments%ROWTYPE;
BEGIN
  v_order_id := private.resolve_order_follow(p_order_number, p_follow_token, true);
  SELECT * INTO v_order FROM public.orders WHERE id = v_order_id;
  SELECT * INTO v_pay
  FROM public.order_payments
  WHERE order_id = v_order_id
  ORDER BY created_at DESC
  LIMIT 1;
  IF NOT FOUND OR v_pay.method <> 'mercado_pago' THEN
    RAISE EXCEPTION 'invalid_payment_method' USING ERRCODE = '23514';
  END IF;
  RETURN jsonb_build_object(
    'payment_id', v_pay.id,
    'order_number', v_order.order_number,
    'status', v_pay.status,
    'amount_due', v_pay.amount_due,
    'currency', v_pay.currency,
    'idempotency_key', v_pay.idempotency_key,
    'external_reference', v_pay.external_reference,
    'expires_at', v_pay.expires_at,
    'preference_id', v_pay.provider_preference_id,
    'checkout_url', v_pay.provider_checkout_url,
    'customer_email', v_order.customer_email,
    'customer_name', v_order.customer_name,
    'customer_phone', v_order.customer_phone
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mp_preference_context_follow(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mp_preference_context_follow(text, text) TO service_role;
