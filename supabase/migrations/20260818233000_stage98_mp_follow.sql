-- Stage 9.8 — Mercado Pago desde el link de seguimiento (sin order_id).
-- Forward-only. No toca sale_price ni flags.

CREATE OR REPLACE FUNCTION public.attach_mp_preference(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_id uuid;
  v_pay public.order_payments%ROWTYPE;
  v_pref text;
  v_url text;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '23514';
  END IF;
  v_order_id := private.resolve_public_order(p_payload, true);
  v_pref := nullif(trim(coalesce(p_payload->>'preference_id', '')), '');
  v_url := nullif(trim(coalesce(p_payload->>'checkout_url', '')), '');
  IF v_pref IS NULL OR char_length(v_pref) < 6 OR v_url IS NULL OR v_url NOT LIKE 'https://%' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_pay
  FROM public.order_payments
  WHERE order_id = v_order_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND OR v_pay.method <> 'mercado_pago' OR v_pay.status <> 'pending' THEN
    RAISE EXCEPTION 'invalid_payment_status' USING ERRCODE = '23514';
  END IF;
  IF v_pay.provider_preference_id IS NOT NULL AND v_pay.provider_preference_id IS DISTINCT FROM v_pref THEN
    RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = '23514';
  END IF;

  UPDATE public.order_payments
  SET
    provider_preference_id = v_pref,
    provider_checkout_url = v_url,
    updated_at = now()
  WHERE id = v_pay.id;

  RETURN jsonb_build_object(
    'payment_id', v_pay.id,
    'preference_id', v_pref,
    'checkout_url', v_url,
    'amount_due', v_pay.amount_due,
    'expires_at', v_pay.expires_at
  );
END;
$$;

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
    'checkout_url', v_pay.provider_checkout_url
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mp_preference_context_follow(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mp_preference_context_follow(text, text) TO service_role;

COMMENT ON FUNCTION public.mp_preference_context_follow(text, text) IS
  'Contexto de preferencia MP con token de seguimiento. Solo service_role.';
