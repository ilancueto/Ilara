-- =============================================================================
-- Stage 9.7 — Link de seguimiento (token de ver + cookie, clave de pago aparte)
-- =============================================================================
-- El token de seguimiento no es la access_capability. Solo se guarda el hash.
-- Pedidos viejos no se reescriben. Flags de cobro no se tocan.

CREATE TABLE IF NOT EXISTS public.order_follow_tokens (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  token_hash text NOT NULL CHECK (char_length(token_hash) = 64),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  can_pay boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_follow_tokens_hash_key UNIQUE (token_hash)
);

COMMENT ON TABLE public.order_follow_tokens IS
  'Hash del token de seguimiento del pedido. Sin plaintext. Distinto de la clave de pago.';

ALTER TABLE public.order_follow_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_follow_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.order_follow_tokens TO service_role;

CREATE OR REPLACE FUNCTION private.resolve_order_follow(
  p_order_number text,
  p_plain text,
  p_require_pay boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hash text;
  v_order_id uuid;
  v_can_pay boolean;
BEGIN
  IF p_plain IS NULL OR char_length(trim(p_plain)) < 32 THEN
    RAISE EXCEPTION 'invalid_follow_token' USING ERRCODE = '42501';
  END IF;
  IF p_order_number IS NULL OR btrim(p_order_number) !~ '^IL-[0-9]{6,}$' THEN
    RAISE EXCEPTION 'invalid_follow_token' USING ERRCODE = '42501';
  END IF;
  v_hash := private.hash_order_access(trim(p_plain));
  SELECT t.order_id, t.can_pay
  INTO v_order_id, v_can_pay
  FROM public.order_follow_tokens t
  INNER JOIN public.orders o ON o.id = t.order_id
  WHERE t.token_hash = v_hash
    AND o.order_number = btrim(p_order_number)
    AND t.revoked_at IS NULL
    AND t.expires_at > now();
  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'invalid_follow_token' USING ERRCODE = '42501';
  END IF;
  IF p_require_pay AND v_can_pay IS NOT TRUE THEN
    RAISE EXCEPTION 'follow_pay_not_allowed' USING ERRCODE = '42501';
  END IF;
  UPDATE public.order_follow_tokens
  SET last_used_at = now()
  WHERE order_id = v_order_id;
  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION private.resolve_order_follow(text, text, boolean)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.resolve_public_order(
  p_payload jsonb,
  p_require_pay boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_follow text;
  v_number text;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '23514';
  END IF;
  IF p_payload ? 'order_id' THEN
    RAISE EXCEPTION 'client_order_id_not_allowed' USING ERRCODE = '23514';
  END IF;
  v_follow := nullif(trim(coalesce(p_payload->>'follow_token', '')), '');
  IF v_follow IS NOT NULL THEN
    v_number := nullif(trim(coalesce(p_payload->>'order_number', '')), '');
    RETURN private.resolve_order_follow(v_number, v_follow, p_require_pay);
  END IF;
  RETURN private.resolve_order_access(p_payload->>'access_capability');
END;
$$;

REVOKE ALL ON FUNCTION private.resolve_public_order(jsonb, boolean)
  FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.create_catalog_order(jsonb)
  RENAME TO create_catalog_order_core_stage96;

REVOKE ALL ON FUNCTION public.create_catalog_order_core_stage96(jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_catalog_order(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_follow_hash text;
  v_result jsonb;
  v_order_id uuid;
  v_replay boolean;
  v_existing text;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '23514';
  END IF;
  v_follow_hash := lower(trim(coalesce(p_payload->>'follow_token_hash', '')));
  IF v_follow_hash <> '' AND v_follow_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_follow_token' USING ERRCODE = '23514';
  END IF;

  v_result := public.create_catalog_order_core_stage96(p_payload - 'follow_token_hash');
  v_order_id := (v_result->>'order_id')::uuid;
  v_replay := coalesce((v_result->>'idempotent_replay')::boolean, false);

  IF v_follow_hash <> '' THEN
    IF v_replay THEN
      SELECT t.token_hash INTO v_existing
      FROM public.order_follow_tokens t
      WHERE t.order_id = v_order_id;
      IF v_existing IS NOT NULL AND v_existing IS DISTINCT FROM v_follow_hash THEN
        RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = '23514';
      END IF;
      IF v_existing IS NULL THEN
        INSERT INTO public.order_follow_tokens (order_id, token_hash, expires_at, can_pay)
        VALUES (v_order_id, v_follow_hash, now() + interval '30 days', true);
      END IF;
    ELSE
      INSERT INTO public.order_follow_tokens (order_id, token_hash, expires_at, can_pay)
      VALUES (v_order_id, v_follow_hash, now() + interval '30 days', true);
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.create_catalog_order(jsonb) IS
  'Crea el pedido, registra la clave de pago y el token de seguimiento. Sin plaintext.';

REVOKE ALL ON FUNCTION public.create_catalog_order(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_catalog_order(jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_catalog_order_follow(
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
  v_quote jsonb;
  v_has_receipt boolean := false;
  v_can_pay boolean := false;
BEGIN
  v_order_id := private.resolve_order_follow(p_order_number, p_follow_token, false);
  SELECT * INTO v_order FROM public.orders WHERE id = v_order_id;
  SELECT t.can_pay INTO v_can_pay
  FROM public.order_follow_tokens t
  WHERE t.order_id = v_order_id;
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
    'fulfillment_mode', v_order.fulfillment_mode,
    'shipping_amount', v_order.shipping_amount,
    'shipping_carrier', v_order.shipping_carrier_description,
    'shipping_service', v_order.shipping_service_description,
    'shipping_delivery_estimate', v_order.shipping_delivery_estimate,
    'can_pay', v_can_pay IS TRUE,
    'payment_status', v_pay.status,
    'method', v_pay.method,
    'amount_due', v_pay.amount_due,
    'base_amount', v_pay.base_amount,
    'quoted_base_amount', (v_quote->>'base_amount')::numeric,
    'quoted_public_amount', (v_quote->>'public_amount')::numeric,
    'transfer_available', (
      v_can_pay IS TRUE
      AND coalesce((v_quote->>'payments_enabled')::boolean, false)
      AND coalesce((v_quote->>'bank_transfer_enabled')::boolean, false)
    ),
    'mp_available', (
      v_can_pay IS TRUE
      AND coalesce((v_quote->>'payments_enabled')::boolean, false)
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
      v_can_pay IS TRUE
      AND v_order.status = 'pending'
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

REVOKE ALL ON FUNCTION public.get_catalog_order_follow(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_catalog_order_follow(text, text)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.start_catalog_order_payment(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_existing public.order_payments%ROWTYPE;
  v_quote jsonb;
  v_method text;
  v_idem text;
  v_order_id uuid;
  v_due numeric;
  v_exp timestamptz;
  v_payment_id uuid;
  v_uplift numeric;
  v_est_fee numeric;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '23514';
  END IF;
  IF p_payload ? 'total' OR p_payload ? 'amount_due' OR p_payload ? 'public_price' THEN
    RAISE EXCEPTION 'client_price_not_allowed' USING ERRCODE = '23514';
  END IF;

  v_order_id := private.resolve_public_order(p_payload, true);

  v_method := lower(trim(coalesce(p_payload->>'method', '')));
  IF v_method NOT IN ('mercado_pago', 'bank_transfer') THEN
    RAISE EXCEPTION 'invalid_payment_method' USING ERRCODE = '23514';
  END IF;

  v_idem := nullif(trim(coalesce(p_payload->>'idempotency_key', '')), '');
  IF v_idem IS NULL OR char_length(v_idem) < 16 OR char_length(v_idem) > 80 THEN
    RAISE EXCEPTION 'invalid_idempotency_key' USING ERRCODE = '23514';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_idem, 1));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_order_id::text, 2));

  SELECT * INTO v_existing FROM public.order_payments WHERE idempotency_key = v_idem;
  IF FOUND THEN
    IF v_existing.order_id <> v_order_id OR v_existing.method <> v_method THEN
      RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = '23514';
    END IF;
    RETURN jsonb_build_object(
      'payment_id', v_existing.id,
      'method', v_existing.method,
      'status', v_existing.status,
      'amount_due', v_existing.amount_due,
      'base_amount', v_existing.base_amount,
      'public_amount', v_existing.public_amount,
      'transfer_saving', v_existing.transfer_saving,
      'price_uplift', v_existing.price_uplift,
      'estimated_fee', v_existing.estimated_fee,
      'expires_at', v_existing.expires_at,
      'idempotent_replay', true
    );
  END IF;

  SELECT * INTO v_order FROM public.orders o WHERE o.id = v_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_order.status <> 'pending' THEN
    RAISE EXCEPTION 'invalid_order_status' USING ERRCODE = '23514';
  END IF;

  v_quote := private.quote_order_payment_amounts(v_order);
  IF coalesce((v_quote->>'payments_enabled')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'payments_disabled' USING ERRCODE = '23514';
  END IF;
  IF v_method = 'mercado_pago' AND coalesce((v_quote->>'mercado_pago_enabled')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'method_disabled' USING ERRCODE = '23514';
  END IF;
  IF v_method = 'bank_transfer' AND coalesce((v_quote->>'bank_transfer_enabled')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'method_disabled' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.order_payments p
    WHERE p.order_id = v_order.id AND p.status IN ('pending', 'requires_review', 'approved')
  ) THEN
    RAISE EXCEPTION 'payment_already_open' USING ERRCODE = '23514';
  END IF;

  IF v_order.stock_reserved IS NOT TRUE THEN
    PERFORM private.reserve_order_stock(v_order.id, NULL);
    UPDATE public.orders SET stock_reserved = true, updated_at = now() WHERE id = v_order.id;
    v_order.stock_reserved := true;
  END IF;

  v_due := CASE
    WHEN v_method = 'bank_transfer' THEN (v_quote->>'base_amount')::numeric
    ELSE (v_quote->>'public_amount')::numeric
  END;
  v_uplift := (v_quote->>'price_uplift')::numeric;
  v_est_fee := CASE
    WHEN v_method = 'mercado_pago'
      THEN round(v_due * (v_quote->>'effective_fee_rate')::numeric, 2)
    ELSE 0
  END;
  v_exp := CASE
    WHEN v_method = 'bank_transfer'
      THEN now() + make_interval(hours => (v_quote->>'transfer_hours')::integer)
    ELSE now() + make_interval(mins => (v_quote->>'mp_minutes')::integer)
  END;

  INSERT INTO public.order_payments (
    order_id, pricing_version_id, idempotency_key, method, provider, status, currency,
    base_amount, public_amount, transfer_saving, price_uplift, amount_due, estimated_fee,
    external_reference, expires_at,
    bank_cbu, bank_alias, bank_name, bank_account_holder, bank_cuit, bank_instructions
  ) VALUES (
    v_order.id,
    (v_quote->>'version_id')::uuid,
    v_idem,
    v_method,
    CASE WHEN v_method = 'mercado_pago' THEN 'mercado_pago' ELSE 'manual' END,
    'pending',
    'ARS',
    (v_quote->>'base_amount')::numeric,
    (v_quote->>'public_amount')::numeric,
    (v_quote->>'transfer_saving')::numeric,
    v_uplift,
    v_due,
    v_est_fee,
    gen_random_uuid()::text,
    v_exp,
    v_quote->>'bank_cbu',
    v_quote->>'bank_alias',
    v_quote->>'bank_name',
    v_quote->>'bank_account_holder',
    v_quote->>'bank_cuit',
    v_quote->>'bank_instructions'
  )
  RETURNING id INTO v_payment_id;

  UPDATE public.orders
  SET
    pricing_version_id = (v_quote->>'version_id')::uuid,
    public_total = (v_quote->>'public_amount')::numeric,
    transfer_saving = (v_quote->>'transfer_saving')::numeric,
    updated_at = now()
  WHERE id = v_order.id;

  INSERT INTO public.payment_events (
    payment_id, provider_event_id, event_type, normalized_status, payload_hash, processing_result
  ) VALUES (
    v_payment_id,
    'start:' || v_payment_id::text,
    'payment.started',
    'pending',
    encode(extensions.digest(v_payment_id::text || v_method, 'sha256'), 'hex'),
    'accepted'
  );

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'order_number', v_order.order_number,
    'method', v_method,
    'status', 'pending',
    'amount_due', v_due,
    'base_amount', (v_quote->>'base_amount')::numeric,
    'public_amount', (v_quote->>'public_amount')::numeric,
    'transfer_saving', (v_quote->>'transfer_saving')::numeric,
    'price_uplift', v_uplift,
    'estimated_fee', v_est_fee,
    'expires_at', v_exp,
    'receipt_required', coalesce((v_quote->>'receipt_required')::boolean, true),
    'stock_reserved', true,
    'idempotent_replay', false
  );
END;
$$;

COMMENT ON FUNCTION public.start_catalog_order_payment(jsonb) IS
  'Inicia pago con clave de pago o con token de seguimiento. No acepta order_id.';

CREATE OR REPLACE FUNCTION public.prepare_transfer_receipt_follow(
  p_order_number text,
  p_follow_token text,
  p_extension text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_id uuid;
  v_pay public.order_payments%ROWTYPE;
  v_ext text;
BEGIN
  v_order_id := private.resolve_order_follow(p_order_number, p_follow_token, true);
  SELECT * INTO v_pay
  FROM public.order_payments
  WHERE order_id = v_order_id
  ORDER BY created_at DESC
  LIMIT 1;
  IF NOT FOUND OR v_pay.method <> 'bank_transfer' OR v_pay.status NOT IN ('pending', 'requires_review') THEN
    RAISE EXCEPTION 'invalid_payment_status' USING ERRCODE = '23514';
  END IF;
  v_ext := lower(trim(coalesce(p_extension, '')));
  IF v_ext NOT IN ('jpg', 'jpeg', 'png', 'webp', 'pdf') THEN
    RAISE EXCEPTION 'invalid_receipt_type' USING ERRCODE = '23514';
  END IF;
  IF v_ext = 'jpeg' THEN
    v_ext := 'jpg';
  END IF;
  RETURN jsonb_build_object(
    'storage_path', v_pay.id::text || '/' || encode(extensions.gen_random_bytes(16), 'hex') || '.' || v_ext
  );
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_transfer_receipt_follow(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_transfer_receipt_follow(text, text, text)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.complete_transfer_receipt_follow(
  p_order_number text,
  p_follow_token text,
  p_storage_path text,
  p_mime_type text,
  p_byte_size integer,
  p_sha256 text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_id uuid;
  v_pay public.order_payments%ROWTYPE;
BEGIN
  v_order_id := private.resolve_order_follow(p_order_number, p_follow_token, true);
  SELECT * INTO v_pay
  FROM public.order_payments
  WHERE order_id = v_order_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND OR v_pay.method <> 'bank_transfer' THEN
    RAISE EXCEPTION 'invalid_payment_method' USING ERRCODE = '23514';
  END IF;
  IF v_pay.status NOT IN ('pending', 'requires_review') THEN
    RAISE EXCEPTION 'invalid_payment_status' USING ERRCODE = '23514';
  END IF;
  IF p_storage_path IS NULL OR p_storage_path NOT LIKE (v_pay.id::text || '/%') THEN
    RAISE EXCEPTION 'invalid_receipt_path' USING ERRCODE = '23514';
  END IF;
  IF p_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') THEN
    RAISE EXCEPTION 'invalid_receipt_type' USING ERRCODE = '23514';
  END IF;
  IF p_byte_size IS NULL OR p_byte_size <= 0 OR p_byte_size > 5242880 THEN
    RAISE EXCEPTION 'invalid_receipt_size' USING ERRCODE = '23514';
  END IF;
  IF p_sha256 IS NULL OR p_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_receipt_hash' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.payment_receipts (payment_id, storage_path, mime_type, byte_size, sha256)
  VALUES (v_pay.id, p_storage_path, p_mime_type, p_byte_size, p_sha256)
  ON CONFLICT (payment_id) DO UPDATE SET
    storage_path = EXCLUDED.storage_path,
    mime_type = EXCLUDED.mime_type,
    byte_size = EXCLUDED.byte_size,
    sha256 = EXCLUDED.sha256,
    uploaded_at = now();

  UPDATE public.order_payments
  SET status = 'requires_review', updated_at = now()
  WHERE id = v_pay.id AND status IN ('pending', 'requires_review');

  INSERT INTO public.payment_events (
    payment_id, provider_event_id, event_type, normalized_status, payload_hash, processing_result
  ) VALUES (
    v_pay.id,
    'receipt:' || v_pay.id::text || ':' || p_sha256,
    'receipt.uploaded',
    'requires_review',
    p_sha256,
    'accepted'
  )
  ON CONFLICT (provider_event_id) DO NOTHING;

  RETURN jsonb_build_object('status', 'requires_review', 'has_receipt', true);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_transfer_receipt_follow(text, text, text, text, integer, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_transfer_receipt_follow(text, text, text, text, integer, text)
  TO anon, authenticated;
