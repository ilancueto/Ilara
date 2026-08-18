-- =============================================================================
-- Stage 8.4 — Mercado Pago: preferencia, webhook canónico y reembolsos
-- =============================================================================
-- Forward-only. Flags permanecen apagados. No confirma por URL de retorno.

ALTER TABLE public.order_payments
  ADD COLUMN IF NOT EXISTS provider_checkout_url text;

COMMENT ON COLUMN public.order_payments.provider_checkout_url IS
  'URL de checkout del proveedor. Solo se entrega al comprador con capability.';
COMMENT ON COLUMN public.order_payments.expected_available_at IS
  'Acreditación operativa: approved_at + 10 días. No es un campo de Preference.';

CREATE OR REPLACE FUNCTION public.get_catalog_payment_public(p_access_capability text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_id uuid;
  v_order public.orders%ROWTYPE;
  v_pay public.order_payments%ROWTYPE;
  v_quote jsonb;
  v_has_receipt boolean := false;
BEGIN
  v_order_id := private.resolve_order_access(p_access_capability);
  SELECT * INTO v_order FROM public.orders WHERE id = v_order_id;
  v_quote := private.quote_order_payment_amounts(v_order);
  SELECT * INTO v_pay
  FROM public.order_payments
  WHERE order_id = v_order_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_pay.id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.payment_receipts r WHERE r.payment_id = v_pay.id
    ) INTO v_has_receipt;
  END IF;

  RETURN jsonb_build_object(
    'order_number', v_order.order_number,
    'order_status', v_order.status,
    'payment_status', v_pay.status,
    'method', v_pay.method,
    'amount_due', v_pay.amount_due,
    'base_amount', v_pay.base_amount,
    'quoted_base_amount', (v_quote->>'base_amount')::numeric,
    'quoted_public_amount', (v_quote->>'public_amount')::numeric,
    'transfer_available', (
      coalesce((v_quote->>'payments_enabled')::boolean, false)
      AND coalesce((v_quote->>'bank_transfer_enabled')::boolean, false)
    ),
    'mp_available', (
      coalesce((v_quote->>'payments_enabled')::boolean, false)
      AND coalesce((v_quote->>'mercado_pago_enabled')::boolean, false)
    ),
    'checkout_url', CASE
      WHEN v_pay.method = 'mercado_pago' AND v_pay.status = 'pending'
        THEN v_pay.provider_checkout_url
      ELSE NULL
    END,
    'currency', coalesce(v_pay.currency, 'ARS'),
    'expires_at', v_pay.expires_at,
    'has_receipt', v_has_receipt,
    'can_retry', (
      v_order.status = 'pending'
      AND v_pay.id IS NOT NULL
      AND v_pay.status IN ('rejected', 'cancelled', 'expired')
    ),
    'bank', CASE
      WHEN v_pay.method = 'bank_transfer' THEN jsonb_build_object(
        'cbu', v_pay.bank_cbu,
        'alias', v_pay.bank_alias,
        'bank_name', v_pay.bank_name,
        'account_holder', v_pay.bank_account_holder,
        'cuit', v_pay.bank_cuit,
        'instructions', v_pay.bank_instructions
      )
      ELSE NULL
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_catalog_payment_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_catalog_payment_public(text) TO anon, authenticated, service_role;

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
  v_order_id := private.resolve_order_access(p_payload->>'access_capability');
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

REVOKE ALL ON FUNCTION public.attach_mp_preference(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_mp_preference(jsonb) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.apply_mercado_pago_payment(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pay public.order_payments%ROWTYPE;
  v_ext text;
  v_mp_status text;
  v_mapped text;
  v_amount numeric;
  v_currency text;
  v_collector text;
  v_event text;
  v_fee numeric;
  v_net numeric;
  v_result text := 'accepted';
  v_provider_id text;
  v_order public.orders%ROWTYPE;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '23514';
  END IF;
  IF p_payload ? 'amount_due' OR p_payload ? 'total' THEN
    RAISE EXCEPTION 'client_price_not_allowed' USING ERRCODE = '23514';
  END IF;

  v_ext := nullif(trim(coalesce(p_payload->>'external_reference', '')), '');
  v_provider_id := nullif(trim(coalesce(p_payload->>'provider_payment_id', '')), '');
  v_mp_status := lower(trim(coalesce(p_payload->>'provider_status', '')));
  v_amount := nullif(p_payload->>'transaction_amount', '')::numeric;
  v_currency := upper(trim(coalesce(p_payload->>'currency_id', '')));
  v_collector := nullif(trim(coalesce(p_payload->>'collector_id', '')), '');
  v_event := nullif(trim(coalesce(p_payload->>'event_id', '')), '');
  v_fee := nullif(p_payload->>'actual_fee', '')::numeric;
  v_net := nullif(p_payload->>'net_received', '')::numeric;

  IF v_ext IS NULL OR v_provider_id IS NULL OR v_event IS NULL THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '23514';
  END IF;

  v_mapped := CASE v_mp_status
    WHEN 'approved' THEN 'approved'
    WHEN 'rejected' THEN 'rejected'
    WHEN 'cancelled' THEN 'cancelled'
    WHEN 'refunded' THEN 'refunded'
    WHEN 'pending' THEN 'pending'
    WHEN 'in_process' THEN 'pending'
    WHEN 'authorized' THEN 'pending'
    WHEN 'in_mediation' THEN 'pending'
    ELSE NULL
  END;

  SELECT * INTO v_pay
  FROM public.order_payments
  WHERE external_reference = v_ext OR id::text = v_ext
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_pay.method <> 'mercado_pago' THEN
    RAISE EXCEPTION 'invalid_payment_method' USING ERRCODE = '23514';
  END IF;
  IF v_currency <> 'ARS' OR v_amount IS DISTINCT FROM v_pay.amount_due THEN
    INSERT INTO public.payment_events (
      payment_id, provider_event_id, event_type, normalized_status, payload_hash, processing_result
    ) VALUES (
      v_pay.id,
      v_event,
      'payment.mismatch',
      v_pay.status,
      encode(extensions.digest(v_ext || coalesce(v_provider_id, ''), 'sha256'), 'hex'),
      'rejected'
    )
    ON CONFLICT (provider_event_id) DO NOTHING;
    RAISE EXCEPTION 'payment_mismatch' USING ERRCODE = '23514';
  END IF;
  IF v_pay.collector_id IS NOT NULL AND v_collector IS NOT NULL AND v_pay.collector_id IS DISTINCT FROM v_collector THEN
    RAISE EXCEPTION 'collector_mismatch' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (SELECT 1 FROM public.payment_events e WHERE e.provider_event_id = v_event) THEN
    RETURN jsonb_build_object('payment_id', v_pay.id, 'status', v_pay.status, 'result', 'duplicate');
  END IF;

  IF v_mapped IS NULL THEN
    INSERT INTO public.payment_events (
      payment_id, provider_event_id, event_type, normalized_status, payload_hash, processing_result
    ) VALUES (
      v_pay.id, v_event, 'payment.ignored', v_pay.status,
      encode(extensions.digest(v_ext || v_mp_status, 'sha256'), 'hex'),
      'ignored_stale'
    );
    RETURN jsonb_build_object('payment_id', v_pay.id, 'status', v_pay.status, 'result', 'ignored_stale');
  END IF;

  IF v_pay.status IN ('approved', 'refunded', 'partially_refunded') AND v_mapped IN ('pending', 'rejected', 'cancelled') THEN
    INSERT INTO public.payment_events (
      payment_id, provider_event_id, event_type, normalized_status, payload_hash, processing_result
    ) VALUES (
      v_pay.id, v_event, 'payment.stale', v_mapped,
      encode(extensions.digest(v_ext || v_mp_status, 'sha256'), 'hex'),
      'ignored_stale'
    );
    RETURN jsonb_build_object('payment_id', v_pay.id, 'status', v_pay.status, 'result', 'ignored_stale');
  END IF;

  IF v_pay.status IN ('expired', 'cancelled') AND v_mapped = 'approved' THEN
    INSERT INTO public.payment_events (
      payment_id, provider_event_id, event_type, normalized_status, payload_hash, processing_result
    ) VALUES (
      v_pay.id, v_event, 'payment.stale', 'approved',
      encode(extensions.digest(v_ext || 'late-approved', 'sha256'), 'hex'),
      'ignored_stale'
    );
    RETURN jsonb_build_object('payment_id', v_pay.id, 'status', v_pay.status, 'result', 'ignored_stale');
  END IF;

  IF v_mapped = 'approved' THEN
    UPDATE public.order_payments
    SET
      status = 'approved',
      provider_payment_id = coalesce(provider_payment_id, v_provider_id),
      collector_id = coalesce(collector_id, v_collector),
      actual_fee = coalesce(v_fee, actual_fee),
      net_received = coalesce(v_net, net_received),
      approved_at = coalesce(approved_at, now()),
      expected_available_at = coalesce(expected_available_at, now() + interval '10 days'),
      updated_at = now()
    WHERE id = v_pay.id;
    PERFORM public.confirm_catalog_order_after_payment(v_pay.order_id);
  ELSIF v_mapped IN ('rejected', 'cancelled') AND v_pay.status IN ('pending', 'requires_review') THEN
    UPDATE public.order_payments
    SET
      status = v_mapped,
      provider_payment_id = coalesce(provider_payment_id, v_provider_id),
      collector_id = coalesce(collector_id, v_collector),
      rejected_at = CASE WHEN v_mapped = 'rejected' THEN coalesce(rejected_at, now()) ELSE rejected_at END,
      cancelled_at = CASE WHEN v_mapped = 'cancelled' THEN coalesce(cancelled_at, now()) ELSE cancelled_at END,
      updated_at = now()
    WHERE id = v_pay.id;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_pay.order_id::text, 2));
    SELECT * INTO v_order FROM public.orders WHERE id = v_pay.order_id FOR UPDATE;
    IF v_order.status = 'pending' AND v_order.stock_reserved IS TRUE THEN
      PERFORM private.restore_order_stock(v_pay.order_id, NULL);
      UPDATE public.orders
      SET stock_reserved = false, updated_at = now()
      WHERE id = v_pay.order_id;
    END IF;
  ELSIF v_mapped = 'refunded' AND v_pay.status IN ('approved', 'partially_refunded', 'refunded') THEN
    UPDATE public.order_payments
    SET
      status = 'refunded',
      refunded_amount = amount_due,
      refunded_at = coalesce(refunded_at, now()),
      actual_fee = coalesce(v_fee, actual_fee),
      net_received = coalesce(v_net, net_received),
      updated_at = now()
    WHERE id = v_pay.id;
  ELSIF v_mapped = 'pending' THEN
    UPDATE public.order_payments
    SET
      provider_payment_id = coalesce(provider_payment_id, v_provider_id),
      collector_id = coalesce(collector_id, v_collector),
      updated_at = now()
    WHERE id = v_pay.id;
    v_result := 'accepted';
  END IF;

  INSERT INTO public.payment_events (
    payment_id, provider_event_id, event_type, normalized_status, payload_hash, processing_result
  ) VALUES (
    v_pay.id,
    v_event,
    'payment.' || coalesce(v_mapped, v_mp_status),
    coalesce(v_mapped, v_pay.status),
    encode(extensions.digest(v_ext || v_provider_id || v_mp_status, 'sha256'), 'hex'),
    v_result
  );

  SELECT status INTO v_mapped FROM public.order_payments WHERE id = v_pay.id;
  RETURN jsonb_build_object('payment_id', v_pay.id, 'status', v_mapped, 'result', v_result);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_mercado_pago_payment(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_mercado_pago_payment(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_refund_catalog_payment(
  p_payment_id uuid,
  p_amount numeric,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_pay public.order_payments%ROWTYPE;
  v_reason text;
  v_amount numeric;
  v_next numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  IF v_reason IS NULL OR char_length(v_reason) < 3 THEN
    RAISE EXCEPTION 'reject_reason_required' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_pay FROM public.order_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_pay.status NOT IN ('approved', 'partially_refunded') THEN
    RAISE EXCEPTION 'invalid_payment_status' USING ERRCODE = '23514';
  END IF;
  v_amount := coalesce(p_amount, v_pay.amount_due - v_pay.refunded_amount);
  IF v_amount IS NULL OR v_amount <= 0 OR v_amount > (v_pay.amount_due - v_pay.refunded_amount) THEN
    RAISE EXCEPTION 'invalid_refund_amount' USING ERRCODE = '23514';
  END IF;
  v_next := v_pay.refunded_amount + v_amount;

  UPDATE public.order_payments
  SET
    refunded_amount = v_next,
    status = CASE WHEN v_next >= amount_due THEN 'refunded' ELSE 'partially_refunded' END,
    refunded_at = coalesce(refunded_at, now()),
    reject_reason = v_reason,
    updated_at = now()
  WHERE id = v_pay.id;

  INSERT INTO public.payment_events (
    payment_id, provider_event_id, event_type, normalized_status, payload_hash, processing_result
  ) VALUES (
    v_pay.id,
    'refund:' || v_pay.id::text || ':' || v_next::text,
    'payment.refunded',
    CASE WHEN v_next >= v_pay.amount_due THEN 'refunded' ELSE 'partially_refunded' END,
    encode(extensions.digest(v_pay.id::text || v_next::text, 'sha256'), 'hex'),
    'accepted'
  )
  ON CONFLICT (provider_event_id) DO NOTHING;

  RETURN jsonb_build_object(
    'payment_id', v_pay.id,
    'status', CASE WHEN v_next >= v_pay.amount_due THEN 'refunded' ELSE 'partially_refunded' END,
    'refunded_amount', v_next,
    'provider', v_pay.provider
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_refund_catalog_payment(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_refund_catalog_payment(uuid, numeric, text)
  TO authenticated, service_role;

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
    'checkout_url', v_pay.provider_checkout_url
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mp_preference_context(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mp_preference_context(text) TO anon, authenticated, service_role;
