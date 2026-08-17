-- =============================================================================
-- Stage 8.3 — acceso por capability, expiración auditable y transferencia
-- =============================================================================
-- Forward-only. No edita migraciones 8.1/8.2. Flags permanecen apagados.
--
-- Acceso: el servidor deriva una clave de alta entropía (HMAC) y solo guarda
-- SHA-256. Expira a 30 días. No es de un solo uso (hace falta para iniciar,
-- ver, transferir y adjuntar). revoked_at la invalida. Un reintento con la
-- misma clave de idempotencia reutiliza el mismo hash; no se emite otra.
--
-- Stock: se reserva al iniciar el pago. Se restaura una sola vez en rechazo,
-- cancelación o vencimiento si seguía reservado. La aprobación confirma el
-- pedido y conserva la reserva. Nunca inserta sales ni incomes.
--
-- estimated_fee = comisión estimada del proveedor (MP). Cero en transferencia.
-- price_uplift = público − base (redondeo/cobertura). No se mezclan.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.order_payments
  ADD COLUMN IF NOT EXISTS price_uplift numeric(12, 2)
    CHECK (price_uplift IS NULL OR price_uplift >= 0);

UPDATE public.order_payments
SET price_uplift = public_amount - base_amount
WHERE price_uplift IS NULL;

COMMENT ON COLUMN public.order_payments.price_uplift IS
  'Diferencia público − base (redondeo/cobertura). No es la comisión de Mercado Pago.';
COMMENT ON COLUMN public.order_payments.estimated_fee IS
  'Comisión efectiva estimada del proveedor (MP). Cero en transferencia.';

CREATE TABLE IF NOT EXISTS public.order_access_capabilities (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  capability_hash text NOT NULL CHECK (char_length(capability_hash) = 64),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_access_capabilities_hash_key UNIQUE (capability_hash)
);

CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.order_payments(id) ON DELETE RESTRICT,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 5242880),
  sha256 text NOT NULL CHECK (char_length(sha256) = 64),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_receipts_payment_key UNIQUE (payment_id)
);

CREATE TABLE IF NOT EXISTS public.payment_expire_runs (
  id bigserial PRIMARY KEY,
  expired_count integer NOT NULL CHECK (expired_count >= 0),
  actor text NOT NULL DEFAULT 'system',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_expire_runs_finished_idx
  ON public.payment_expire_runs (finished_at DESC);

COMMENT ON TABLE public.order_access_capabilities IS
  'Stage 8.3: hash de la clave de seguimiento del pedido. Sin plaintext.';
COMMENT ON TABLE public.payment_receipts IS
  'Stage 8.3: metadatos de comprobantes. El binario vive en Storage privado.';
COMMENT ON TABLE public.payment_expire_runs IS
  'Stage 8.3: evidencia de corridas de expiración. Sin secretos.';

ALTER TABLE public.order_access_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_expire_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.order_access_capabilities FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.payment_receipts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.payment_expire_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.order_access_capabilities TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_receipts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_expire_runs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.payment_expire_runs_id_seq TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-receipts',
  'payment-receipts',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[];

-- ─── Helpers ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.hash_order_access(p_plain text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT encode(extensions.digest(convert_to(p_plain, 'UTF8'), 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION private.resolve_order_access(p_plain text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hash text;
  v_order_id uuid;
BEGIN
  IF p_plain IS NULL OR char_length(trim(p_plain)) < 32 THEN
    RAISE EXCEPTION 'invalid_access_capability' USING ERRCODE = '42501';
  END IF;
  v_hash := private.hash_order_access(trim(p_plain));
  SELECT c.order_id INTO v_order_id
  FROM public.order_access_capabilities c
  WHERE c.capability_hash = v_hash
    AND c.revoked_at IS NULL
    AND c.expires_at > now();
  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'invalid_access_capability' USING ERRCODE = '42501';
  END IF;
  UPDATE public.order_access_capabilities
  SET last_used_at = now()
  WHERE order_id = v_order_id;
  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION private.hash_order_access(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.resolve_order_access(text) FROM PUBLIC, anon, authenticated;

-- ─── Envolver create_catalog_order ───────────────────────────────────────────
ALTER FUNCTION public.create_catalog_order(jsonb)
  RENAME TO create_catalog_order_core_stage72;

REVOKE ALL ON FUNCTION public.create_catalog_order_core_stage72(jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_catalog_order(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hash text;
  v_result jsonb;
  v_order_id uuid;
  v_replay boolean;
  v_existing text;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '23514';
  END IF;
  v_hash := lower(trim(coalesce(p_payload->>'access_capability_hash', '')));
  IF v_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_access_capability' USING ERRCODE = '23514';
  END IF;

  v_result := public.create_catalog_order_core_stage72(p_payload - 'access_capability_hash');
  v_order_id := (v_result->>'order_id')::uuid;
  v_replay := coalesce((v_result->>'idempotent_replay')::boolean, false);

  IF v_replay THEN
    SELECT c.capability_hash INTO v_existing
    FROM public.order_access_capabilities c
    WHERE c.order_id = v_order_id;
    IF v_existing IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = '23514';
    END IF;
  ELSE
    INSERT INTO public.order_access_capabilities (order_id, capability_hash, expires_at)
    VALUES (v_order_id, v_hash, now() + interval '30 days');
  END IF;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.create_catalog_order(jsonb) IS
  'Stage 8.3: crea pedido y registra hash de la clave de seguimiento. Sin plaintext.';

REVOKE ALL ON FUNCTION public.create_catalog_order(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_catalog_order(jsonb) TO anon, authenticated;

-- ─── Quote: exponer tasa para comisión estimada ──────────────────────────────
CREATE OR REPLACE FUNCTION private.quote_order_payment_amounts(p_order public.orders)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_ver public.payment_pricing_versions%ROWTYPE;
  v_base numeric := 0;
  v_public numeric := 0;
  rec record;
  v_unit_public numeric;
BEGIN
  SELECT * INTO v_ver
  FROM public.payment_pricing_versions
  WHERE status = 'active'
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pricing_version_missing' USING ERRCODE = 'P0002';
  END IF;

  FOR rec IN
    SELECT oi.quantity, oi.unit_price
    FROM public.order_items oi
    WHERE oi.order_id = p_order.id
  LOOP
    v_unit_public := public.payment_public_price(rec.unit_price, v_ver.effective_fee_rate, v_ver.rounding_increment);
    v_base := v_base + rec.unit_price * rec.quantity;
    v_public := v_public + v_unit_public * rec.quantity;
  END LOOP;

  IF coalesce(p_order.coupon_discount_percentage, 0) > 0 THEN
    v_base := v_base - round(v_base * p_order.coupon_discount_percentage::numeric / 100.0, 0);
    v_public := v_public - round(v_public * p_order.coupon_discount_percentage::numeric / 100.0, 0);
  END IF;

  v_base := greatest(v_base, 0) + coalesce(p_order.shipping_amount, 0);
  IF coalesce(p_order.shipping_amount, 0) > 0 THEN
    v_public := greatest(v_public, 0) + public.payment_public_price(
      p_order.shipping_amount, v_ver.effective_fee_rate, v_ver.rounding_increment
    );
  ELSE
    v_public := greatest(v_public, 0);
  END IF;

  RETURN jsonb_build_object(
    'version_id', v_ver.id,
    'effective_fee_rate', v_ver.effective_fee_rate,
    'base_amount', v_base,
    'public_amount', v_public,
    'price_uplift', v_public - v_base,
    'transfer_saving', v_public - v_base,
    'mp_minutes', v_ver.mp_reservation_minutes,
    'transfer_hours', v_ver.transfer_reservation_hours,
    'payments_enabled', v_ver.payments_enabled,
    'mercado_pago_enabled', v_ver.mercado_pago_enabled,
    'bank_transfer_enabled', v_ver.bank_transfer_enabled,
    'receipt_required', v_ver.receipt_required,
    'bank_cbu', v_ver.bank_cbu,
    'bank_alias', v_ver.bank_alias,
    'bank_name', v_ver.bank_name,
    'bank_account_holder', v_ver.bank_account_holder,
    'bank_cuit', v_ver.bank_cuit,
    'bank_instructions', v_ver.bank_instructions
  );
END;
$$;

-- ─── start payment: capability obligatoria ───────────────────────────────────
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

  v_order_id := private.resolve_order_access(p_payload->>'access_capability');

  IF p_payload ? 'order_id' THEN
    RAISE EXCEPTION 'client_order_id_not_allowed' USING ERRCODE = '23514';
  END IF;

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
  'Stage 8.3: inicia pago sólo con clave de seguimiento. No acepta order_id.';

REVOKE ALL ON FUNCTION public.start_catalog_order_payment(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_catalog_order_payment(jsonb) TO anon, authenticated, service_role;

-- ─── Lectura pública del pago ────────────────────────────────────────────────
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
GRANT EXECUTE ON FUNCTION public.get_catalog_payment_public(text) TO anon, authenticated;

-- ─── Comprobante ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.complete_transfer_receipt(
  p_access_capability text,
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
  v_order_id := private.resolve_order_access(p_access_capability);
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

REVOKE ALL ON FUNCTION public.complete_transfer_receipt(text, text, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_transfer_receipt(text, text, text, integer, text)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.prepare_transfer_receipt(
  p_access_capability text,
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
  v_order_id := private.resolve_order_access(p_access_capability);
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

REVOKE ALL ON FUNCTION public.prepare_transfer_receipt(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_transfer_receipt(text, text) TO anon, authenticated;

-- ─── Admin transferencia ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_review_transfer_payment(
  p_payment_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_pay public.order_payments%ROWTYPE;
  v_action text;
  v_reason text;
  v_has_receipt boolean;
  v_order public.orders%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  v_action := lower(trim(coalesce(p_action, '')));
  IF v_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '23514';
  END IF;
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  SELECT * INTO v_pay FROM public.order_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_pay.method <> 'bank_transfer' THEN
    RAISE EXCEPTION 'invalid_payment_method' USING ERRCODE = '23514';
  END IF;

  IF v_action = 'approve' THEN
    IF v_pay.status NOT IN ('pending', 'requires_review') THEN
      RAISE EXCEPTION 'invalid_payment_status' USING ERRCODE = '23514';
    END IF;
    SELECT EXISTS (SELECT 1 FROM public.payment_receipts r WHERE r.payment_id = v_pay.id)
    INTO v_has_receipt;
    IF NOT v_has_receipt THEN
      RAISE EXCEPTION 'receipt_required' USING ERRCODE = '23514';
    END IF;
    UPDATE public.order_payments
    SET status = 'approved', approved_at = coalesce(approved_at, now()), updated_at = now()
    WHERE id = v_pay.id;
    PERFORM public.confirm_catalog_order_after_payment(v_pay.order_id);
  ELSE
    IF v_reason IS NULL OR char_length(v_reason) < 3 THEN
      RAISE EXCEPTION 'reject_reason_required' USING ERRCODE = '23514';
    END IF;
    IF v_pay.status NOT IN ('pending', 'requires_review') THEN
      RAISE EXCEPTION 'invalid_payment_status' USING ERRCODE = '23514';
    END IF;
    UPDATE public.order_payments
    SET
      status = 'rejected',
      rejected_at = now(),
      reject_reason = v_reason,
      updated_at = now()
    WHERE id = v_pay.id;

    SELECT * INTO v_order FROM public.orders o WHERE o.id = v_pay.order_id FOR UPDATE;
    IF v_order.status = 'pending' AND v_order.stock_reserved IS TRUE THEN
      PERFORM private.restore_order_stock(v_pay.order_id, NULL);
      UPDATE public.orders
      SET stock_reserved = false, updated_at = now()
      WHERE id = v_pay.order_id;
    END IF;
  END IF;

  INSERT INTO public.payment_events (
    payment_id, provider_event_id, event_type, normalized_status, payload_hash, processing_result
  ) VALUES (
    v_pay.id,
    'review:' || v_pay.id::text || ':' || v_action || ':' || extract(epoch from now())::bigint::text,
    'payment.' || v_action,
    CASE WHEN v_action = 'approve' THEN 'approved' ELSE 'rejected' END,
    encode(extensions.digest(v_pay.id::text || v_action, 'sha256'), 'hex'),
    'accepted'
  );

  RETURN jsonb_build_object(
    'payment_id', v_pay.id,
    'status', CASE WHEN v_action = 'approve' THEN 'approved' ELSE 'rejected' END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_order_payments(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', p.id,
      'method', p.method,
      'status', p.status,
      'amount_due', p.amount_due,
      'base_amount', p.base_amount,
      'public_amount', p.public_amount,
      'transfer_saving', p.transfer_saving,
      'price_uplift', p.price_uplift,
      'estimated_fee', p.estimated_fee,
      'expires_at', p.expires_at,
      'approved_at', p.approved_at,
      'rejected_at', p.rejected_at,
      'reject_reason', p.reject_reason,
      'has_receipt', EXISTS (SELECT 1 FROM public.payment_receipts r WHERE r.payment_id = p.id),
      'receipt_path', (SELECT r.storage_path FROM public.payment_receipts r WHERE r.payment_id = p.id)
    ) ORDER BY p.created_at DESC)
    FROM public.order_payments p
    WHERE p.order_id = p_order_id
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_payment_receipt_path(p_payment_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_path text;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  SELECT r.storage_path INTO v_path
  FROM public.payment_receipts r
  WHERE r.payment_id = p_payment_id;
  RETURN v_path;
END;
$$;

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'admin_review_transfer_payment(uuid,text,text)',
    'admin_order_payments(uuid)',
    'admin_payment_receipt_path(uuid)'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', fn);
  END LOOP;
END $$;

-- ─── Expire con evidencia; restore único ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.expire_catalog_payments()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  rec record;
  v_count integer := 0;
  v_order public.orders%ROWTYPE;
  v_started timestamptz := clock_timestamp();
BEGIN
  FOR rec IN
    SELECT p.id, p.order_id
    FROM public.order_payments p
    WHERE p.status IN ('pending', 'requires_review')
      AND p.expires_at <= now()
    ORDER BY p.expires_at
    FOR UPDATE OF p SKIP LOCKED
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(rec.order_id::text, 2));

    UPDATE public.order_payments
    SET status = 'expired', cancelled_at = coalesce(cancelled_at, now()), updated_at = now()
    WHERE id = rec.id AND status IN ('pending', 'requires_review');
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    INSERT INTO public.payment_events (
      payment_id, provider_event_id, event_type, normalized_status, payload_hash, processing_result
    ) VALUES (
      rec.id,
      'expire:' || rec.id::text,
      'payment.expired',
      'expired',
      encode(extensions.digest(rec.id::text || 'expired', 'sha256'), 'hex'),
      'accepted'
    )
    ON CONFLICT (provider_event_id) DO NOTHING;

    SELECT * INTO v_order FROM public.orders o WHERE o.id = rec.order_id FOR UPDATE;
    IF v_order.status = 'pending' THEN
      IF v_order.stock_reserved IS TRUE THEN
        PERFORM private.restore_order_stock(rec.order_id, NULL);
        v_order.stock_reserved := false;
      END IF;
      UPDATE public.orders o
      SET
        status = 'cancelled',
        cancelled_at = coalesce(o.cancelled_at, now()),
        cancel_reason = coalesce(o.cancel_reason, 'Pago vencido'),
        updated_at = now(),
        stock_reserved = v_order.stock_reserved
      WHERE o.id = rec.order_id;
      INSERT INTO public.order_status_events (
        order_id, from_status, to_status, actor_user_id, actor_kind, reason
      ) VALUES (
        rec.order_id, 'pending', 'cancelled', NULL, 'system', 'Pago vencido'
      );
    END IF;

    v_count := v_count + 1;
  END LOOP;

  INSERT INTO public.payment_expire_runs (expired_count, actor, started_at, finished_at)
  VALUES (v_count, 'system', v_started, clock_timestamp());

  RETURN jsonb_build_object(
    'expired', v_count,
    'finished_at', clock_timestamp()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.expire_catalog_payments() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_catalog_payments() TO service_role;

CREATE OR REPLACE FUNCTION public.payment_expire_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_last public.payment_expire_runs%ROWTYPE;
BEGIN
  SELECT * INTO v_last
  FROM public.payment_expire_runs
  ORDER BY finished_at DESC
  LIMIT 1;
  RETURN jsonb_build_object(
    'has_run', FOUND,
    'last_finished_at', v_last.finished_at,
    'last_expired_count', v_last.expired_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.payment_expire_health() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_expire_health() TO service_role;
