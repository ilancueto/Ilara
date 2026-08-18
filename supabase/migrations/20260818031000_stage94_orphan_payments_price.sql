-- =============================================================================
-- Stage 9.4 hotfix — pagos huérfanos y precio visible de Mercado Pago
-- =============================================================================
-- Cierra cobros pending de pedidos cancelados. Un webhook no puede acreditarlos.
-- El catálogo recibe la tarifa pública cuando Mercado Pago está encendido.

UPDATE public.order_payments op
SET
  status = 'cancelled',
  cancelled_at = coalesce(op.cancelled_at, now()),
  updated_at = now()
FROM public.orders o
WHERE o.id = op.order_id
  AND o.status = 'cancelled'
  AND op.status IN ('pending', 'requires_review');

INSERT INTO public.payment_events (
  payment_id, provider_event_id, event_type, normalized_status, payload_hash, processing_result
)
SELECT
  op.id,
  'orphan-cancel:' || op.id::text,
  'payment.cancelled',
  'cancelled',
  encode(extensions.digest(op.id::text || 'orphan-cancel', 'sha256'), 'hex'),
  'accepted'
FROM public.order_payments op
JOIN public.orders o ON o.id = op.order_id
WHERE o.status = 'cancelled'
  AND op.status = 'cancelled'
  AND op.cancelled_at IS NOT NULL
ON CONFLICT (provider_event_id) DO NOTHING;

CREATE OR REPLACE FUNCTION private.cancel_open_payments_on_order_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    UPDATE public.order_payments
    SET
      status = 'cancelled',
      cancelled_at = coalesce(cancelled_at, now()),
      updated_at = now()
    WHERE order_id = NEW.id
      AND status IN ('pending', 'requires_review');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_cancel_open_payments_trg ON public.orders;
CREATE TRIGGER orders_cancel_open_payments_trg
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION private.cancel_open_payments_on_order_cancel();

REVOKE ALL ON FUNCTION private.cancel_open_payments_on_order_cancel()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.payment_public_pricing_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.payment_pricing_versions%ROWTYPE;
  v_show_public boolean := false;
BEGIN
  SELECT * INTO v_row
  FROM public.payment_pricing_versions
  WHERE status = 'active'
  ORDER BY version_number DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('catalog_dual_price_visible', false);
  END IF;

  v_show_public :=
    v_row.catalog_dual_price_visible IS TRUE
    OR (
      v_row.payments_enabled IS TRUE
      AND v_row.mercado_pago_enabled IS TRUE
    );

  IF NOT v_show_public THEN
    RETURN jsonb_build_object('catalog_dual_price_visible', false);
  END IF;

  RETURN jsonb_build_object(
    'catalog_dual_price_visible', v_row.catalog_dual_price_visible IS TRUE,
    'mercado_pago_enabled', v_row.mercado_pago_enabled IS TRUE,
    'version_id', v_row.id,
    'effective_fee_rate', v_row.effective_fee_rate,
    'rounding_increment', v_row.rounding_increment
  );
END;
$$;

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
      AND v_order.status = 'pending'
    ),
    'checkout_url', CASE
      WHEN v_order.status = 'pending'
        AND v_pay.method = 'mercado_pago'
        AND v_pay.status = 'pending'
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

  SELECT * INTO v_order FROM public.orders WHERE id = v_pay.order_id FOR UPDATE;

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

  IF v_order.status = 'cancelled' AND v_mapped = 'approved' THEN
    IF v_pay.status IN ('pending', 'requires_review') THEN
      UPDATE public.order_payments
      SET
        status = 'cancelled',
        cancelled_at = coalesce(cancelled_at, now()),
        updated_at = now()
      WHERE id = v_pay.id;
    END IF;
    INSERT INTO public.payment_events (
      payment_id, provider_event_id, event_type, normalized_status, payload_hash, processing_result
    ) VALUES (
      v_pay.id, v_event, 'payment.stale', 'approved',
      encode(extensions.digest(v_ext || 'approved-cancelled-order', 'sha256'), 'hex'),
      'ignored_stale'
    );
    RETURN jsonb_build_object('payment_id', v_pay.id, 'status', 'cancelled', 'result', 'ignored_cancelled_order');
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
