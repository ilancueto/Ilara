-- =============================================================================
-- Stage 8.2 — Core de pagos, stock al iniciar e expiración
-- =============================================================================
-- Forward-only. Flags de cobro siguen apagados. No confirma por URL de retorno.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pricing_version_id uuid
    REFERENCES public.payment_pricing_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS public_total numeric(12, 2)
    CHECK (public_total IS NULL OR public_total >= 0),
  ADD COLUMN IF NOT EXISTS transfer_saving numeric(12, 2)
    CHECK (transfer_saving IS NULL OR transfer_saving >= 0);

CREATE TABLE IF NOT EXISTS public.order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  pricing_version_id uuid NOT NULL REFERENCES public.payment_pricing_versions(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  method text NOT NULL CHECK (method IN ('mercado_pago', 'bank_transfer')),
  provider text NOT NULL CHECK (provider IN ('mercado_pago', 'manual')),
  status text NOT NULL CHECK (status IN (
    'pending', 'requires_review', 'approved', 'rejected', 'cancelled',
    'expired', 'partially_refunded', 'refunded'
  )),
  currency text NOT NULL DEFAULT 'ARS' CHECK (currency = 'ARS'),
  base_amount numeric(12, 2) NOT NULL CHECK (base_amount >= 0),
  public_amount numeric(12, 2) NOT NULL CHECK (public_amount >= 0),
  transfer_saving numeric(12, 2) NOT NULL CHECK (transfer_saving >= 0),
  amount_due numeric(12, 2) NOT NULL CHECK (amount_due >= 0),
  estimated_fee numeric(12, 2) CHECK (estimated_fee IS NULL OR estimated_fee >= 0),
  actual_fee numeric(12, 2) CHECK (actual_fee IS NULL OR actual_fee >= 0),
  net_received numeric(12, 2) CHECK (net_received IS NULL OR net_received >= 0),
  refunded_amount numeric(12, 2) NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
  provider_preference_id text,
  provider_payment_id text,
  external_reference text NOT NULL,
  collector_id text,
  expires_at timestamptz NOT NULL,
  approved_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  expected_available_at timestamptz,
  reconciled_at timestamptz,
  reject_reason text CHECK (reject_reason IS NULL OR char_length(reject_reason) BETWEEN 3 AND 300),
  bank_cbu text,
  bank_alias text,
  bank_name text,
  bank_account_holder text,
  bank_cuit text,
  bank_instructions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_payments_idempotency_key UNIQUE (idempotency_key),
  CONSTRAINT order_payments_external_reference_key UNIQUE (external_reference),
  CONSTRAINT order_payments_amount_due_matches CHECK (
    (method = 'bank_transfer' AND amount_due = base_amount)
    OR (method = 'mercado_pago' AND amount_due = public_amount)
  ),
  CONSTRAINT order_payments_saving_matches CHECK (transfer_saving = public_amount - base_amount)
);

CREATE UNIQUE INDEX IF NOT EXISTS order_payments_one_open_per_order
  ON public.order_payments (order_id)
  WHERE status IN ('pending', 'requires_review');

CREATE UNIQUE INDEX IF NOT EXISTS order_payments_provider_payment_id
  ON public.order_payments (provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS order_payments_order_id_idx
  ON public.order_payments (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS order_payments_status_expires_idx
  ON public.order_payments (status, expires_at);

CREATE TABLE IF NOT EXISTS public.payment_events (
  id bigserial PRIMARY KEY,
  payment_id uuid NOT NULL REFERENCES public.order_payments(id) ON DELETE RESTRICT,
  provider_event_id text,
  event_type text NOT NULL CHECK (char_length(event_type) BETWEEN 1 AND 80),
  normalized_status text,
  payload_hash text NOT NULL CHECK (char_length(payload_hash) = 64),
  processing_result text NOT NULL CHECK (processing_result IN (
    'accepted', 'duplicate', 'rejected', 'ignored_stale'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_events_provider_event_id_key UNIQUE (provider_event_id)
);

CREATE INDEX IF NOT EXISTS payment_events_payment_id_idx
  ON public.payment_events (payment_id, created_at);

CREATE TABLE IF NOT EXISTS public.payment_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.order_payments(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  token_hash text NOT NULL CHECK (char_length(token_hash) = 64),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_access_tokens_hash_key UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS payment_access_tokens_payment_idx
  ON public.payment_access_tokens (payment_id);

COMMENT ON TABLE public.order_payments IS
  'Stage 8.2: intentos de pago. Anon no enumera. Importes autoritativos.';
COMMENT ON TABLE public.payment_events IS
  'Stage 8.2: eventos append-only e idempotentes. Sin PII ni PAN.';
COMMENT ON TABLE public.payment_access_tokens IS
  'Stage 8.2: solo hash del token opaco. El plaintext se devuelve una vez.';

ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_access_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.order_payments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.payment_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.payment_access_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.order_payments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_access_tokens TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.payment_events_id_seq TO service_role;

-- ─── Stock helpers ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.order_needed_stock(p_order_id uuid)
RETURNS TABLE (product_id integer, qty bigint)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH expanded AS (
    SELECT oi.product_id_snapshot AS product_id, oi.quantity::bigint AS qty
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id AND oi.line_type = 'product'
    UNION ALL
    SELECT
      (comp->>'product_id')::integer,
      oi.quantity::bigint * (comp->>'quantity')::bigint
    FROM public.order_items oi
    CROSS JOIN LATERAL jsonb_array_elements(oi.combo_components_snapshot) AS comp
    WHERE oi.order_id = p_order_id AND oi.line_type = 'combo'
  )
  SELECT e.product_id, sum(e.qty)::bigint
  FROM expanded e
  WHERE e.product_id IS NOT NULL
  GROUP BY e.product_id;
$$;

CREATE OR REPLACE FUNCTION private.reserve_order_stock(p_order_id uuid, p_actor uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_has_sm boolean;
  rec record;
  v_number text;
BEGIN
  SELECT o.order_number INTO v_number FROM public.orders o WHERE o.id = p_order_id;
  IF EXISTS (
    SELECT 1
    FROM private.order_needed_stock(p_order_id) n
    LEFT JOIN public.products p ON p.id = n.product_id
    WHERE n.product_id IS NULL OR p.id IS NULL
  ) THEN
    RAISE EXCEPTION 'product_not_available' USING ERRCODE = '23514';
  END IF;

  FOR rec IN
    SELECT p.id AS product_id, p.stock, n.qty
    FROM private.order_needed_stock(p_order_id) n
    INNER JOIN public.products p ON p.id = n.product_id
    ORDER BY p.id
    FOR UPDATE OF p
  LOOP
    IF rec.stock < rec.qty THEN
      RAISE EXCEPTION 'insufficient_stock'
        USING ERRCODE = '23514',
        DETAIL = format('product_id=%s need=%s have=%s', rec.product_id, rec.qty, rec.stock);
    END IF;
  END LOOP;

  UPDATE public.products p
  SET stock = p.stock - n.qty, updated_at = now()
  FROM private.order_needed_stock(p_order_id) n
  WHERE p.id = n.product_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stock_movements'
  ) INTO v_has_sm;
  IF v_has_sm THEN
    INSERT INTO public.stock_movements (
      product_id, type, quantity, reference_type, reference_id, notes, user_id
    )
    SELECT n.product_id, 'sale', -n.qty, 'order', NULL, 'order:' || v_number, p_actor
    FROM private.order_needed_stock(p_order_id) n;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.restore_order_stock(p_order_id uuid, p_actor uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_has_sm boolean;
  rec record;
  v_number text;
BEGIN
  SELECT o.order_number INTO v_number FROM public.orders o WHERE o.id = p_order_id;
  FOR rec IN
    SELECT p.id AS product_id, n.qty
    FROM private.order_needed_stock(p_order_id) n
    INNER JOIN public.products p ON p.id = n.product_id
    ORDER BY p.id
    FOR UPDATE OF p
  LOOP
    UPDATE public.products SET stock = stock + rec.qty, updated_at = now()
    WHERE id = rec.product_id;
  END LOOP;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stock_movements'
  ) INTO v_has_sm;
  IF v_has_sm THEN
    INSERT INTO public.stock_movements (
      product_id, type, quantity, reference_type, reference_id, notes, user_id
    )
    SELECT n.product_id, 'adjustment', n.qty, 'order', NULL, 'order_cancel:' || v_number, p_actor
    FROM private.order_needed_stock(p_order_id) n;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.order_needed_stock(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.reserve_order_stock(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.restore_order_stock(uuid, uuid) FROM PUBLIC, anon, authenticated;

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
    'base_amount', v_base,
    'public_amount', v_public,
    'transfer_saving', v_public - v_base,
    'mp_minutes', v_ver.mp_reservation_minutes,
    'transfer_hours', v_ver.transfer_reservation_hours,
    'payments_enabled', v_ver.payments_enabled,
    'mercado_pago_enabled', v_ver.mercado_pago_enabled,
    'bank_transfer_enabled', v_ver.bank_transfer_enabled,
    'bank_cbu', v_ver.bank_cbu,
    'bank_alias', v_ver.bank_alias,
    'bank_name', v_ver.bank_name,
    'bank_account_holder', v_ver.bank_account_holder,
    'bank_cuit', v_ver.bank_cuit,
    'bank_instructions', v_ver.bank_instructions
  );
END;
$$;

-- ─── start payment ───────────────────────────────────────────────────────────
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
  v_hash text;
  v_plain_token text;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '23514';
  END IF;
  IF p_payload ? 'total' OR p_payload ? 'amount_due' OR p_payload ? 'public_price' THEN
    RAISE EXCEPTION 'client_price_not_allowed' USING ERRCODE = '23514';
  END IF;

  BEGIN
    v_order_id := nullif(trim(coalesce(p_payload->>'order_id', '')), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'invalid_order_id' USING ERRCODE = '23514';
  END;
  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'invalid_order_id' USING ERRCODE = '23514';
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
      'order_id', v_existing.order_id,
      'method', v_existing.method,
      'status', v_existing.status,
      'amount_due', v_existing.amount_due,
      'base_amount', v_existing.base_amount,
      'public_amount', v_existing.public_amount,
      'transfer_saving', v_existing.transfer_saving,
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
  v_exp := CASE
    WHEN v_method = 'bank_transfer'
      THEN now() + make_interval(hours => (v_quote->>'transfer_hours')::integer)
    ELSE now() + make_interval(mins => (v_quote->>'mp_minutes')::integer)
  END;

  INSERT INTO public.order_payments (
    order_id, pricing_version_id, idempotency_key, method, provider, status, currency,
    base_amount, public_amount, transfer_saving, amount_due, estimated_fee,
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
    v_due,
    CASE WHEN v_method = 'mercado_pago'
      THEN (v_quote->>'public_amount')::numeric - (v_quote->>'base_amount')::numeric
      ELSE 0
    END,
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

  v_plain_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_plain_token, 'sha256'), 'hex');
  INSERT INTO public.payment_access_tokens (payment_id, order_id, token_hash, expires_at)
  VALUES (v_payment_id, v_order.id, v_hash, v_exp + interval '1 hour');

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
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'method', v_method,
    'status', 'pending',
    'amount_due', v_due,
    'base_amount', (v_quote->>'base_amount')::numeric,
    'public_amount', (v_quote->>'public_amount')::numeric,
    'transfer_saving', (v_quote->>'transfer_saving')::numeric,
    'expires_at', v_exp,
    'access_token', v_plain_token,
    'stock_reserved', true,
    'idempotent_replay', false
  );
END;
$$;

COMMENT ON FUNCTION public.start_catalog_order_payment(jsonb) IS
  'Stage 8.2: inicia un pago, reserva stock una vez y emite token opaco.';

REVOKE ALL ON FUNCTION public.start_catalog_order_payment(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_catalog_order_payment(jsonb) TO anon, authenticated, service_role;

-- ─── expire ──────────────────────────────────────────────────────────────────
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

  RETURN jsonb_build_object('expired', v_count);
END;
$$;

COMMENT ON FUNCTION public.expire_catalog_payments() IS
  'Stage 8.2: expira pagos pendientes, cancela pedidos pending y restaura stock.';

REVOKE ALL ON FUNCTION public.expire_catalog_payments() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_catalog_payments() TO service_role;

-- Confirmar pedido solo si hay pago aprobado; no re-reserva.
CREATE OR REPLACE FUNCTION public.confirm_catalog_order_after_payment(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders o WHERE o.id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_order.status = 'confirmed' THEN
    RETURN jsonb_build_object('order_id', v_order.id, 'status', v_order.status, 'idempotent_replay', true);
  END IF;
  IF v_order.status <> 'pending' THEN
    RAISE EXCEPTION 'invalid_order_status' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.order_payments p
    WHERE p.order_id = v_order.id AND p.status = 'approved'
  ) THEN
    RAISE EXCEPTION 'payment_not_approved' USING ERRCODE = '23514';
  END IF;
  IF v_order.stock_reserved IS NOT TRUE THEN
    RAISE EXCEPTION 'stock_not_reserved' USING ERRCODE = '23514';
  END IF;

  UPDATE public.orders
  SET status = 'confirmed', confirmed_at = coalesce(confirmed_at, now()), updated_at = now()
  WHERE id = v_order.id;

  INSERT INTO public.order_status_events (
    order_id, from_status, to_status, actor_user_id, actor_kind, reason
  ) VALUES (
    v_order.id, 'pending', 'confirmed', NULL, 'system', 'Pago aprobado'
  );

  RETURN jsonb_build_object('order_id', v_order.id, 'status', 'confirmed', 'idempotent_replay', false);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_catalog_order_after_payment(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_catalog_order_after_payment(uuid) TO service_role;

-- Bloquear confirmación admin si la capa de pagos está encendida y no hay cobro.
CREATE OR REPLACE FUNCTION public.transition_catalog_order(
  p_order_id uuid,
  p_to_status text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_order public.orders%ROWTYPE;
  v_from text;
  v_to text;
  v_reason text;
  v_allowed boolean := false;
  v_payments_on boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'invalid_order_id' USING ERRCODE = '23514';
  END IF;

  v_to := lower(trim(coalesce(p_to_status, '')));
  IF v_to NOT IN ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '23514';
  END IF;
  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  IF v_reason IS NOT NULL AND char_length(v_reason) > 300 THEN
    RAISE EXCEPTION 'invalid_reason' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_order FROM public.orders o WHERE o.id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;
  v_from := v_order.status;
  IF v_from = v_to THEN
    RETURN jsonb_build_object(
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'status', v_order.status,
      'stock_reserved', v_order.stock_reserved,
      'idempotent_replay', true
    );
  END IF;

  IF v_from = 'pending' AND v_to IN ('confirmed', 'cancelled') THEN
    v_allowed := true;
  ELSIF v_from = 'confirmed' AND v_to IN ('preparing', 'cancelled') THEN
    v_allowed := true;
  ELSIF v_from = 'preparing' AND v_to IN ('ready', 'cancelled') THEN
    v_allowed := true;
  ELSIF v_from = 'ready' AND v_to IN ('completed', 'cancelled') THEN
    v_allowed := true;
  END IF;
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'invalid_transition' USING ERRCODE = '23514';
  END IF;
  IF v_to = 'cancelled' AND (v_reason IS NULL OR char_length(v_reason) < 3) THEN
    RAISE EXCEPTION 'cancel_reason_required' USING ERRCODE = '23514';
  END IF;

  SELECT coalesce(bool_or(payments_enabled), false) INTO v_payments_on
  FROM public.payment_pricing_versions
  WHERE status = 'active';

  IF v_payments_on AND v_from = 'pending' AND v_to = 'confirmed' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.order_payments p
      WHERE p.order_id = v_order.id AND p.status = 'approved'
    ) THEN
      RAISE EXCEPTION 'payment_not_approved' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF v_to = 'confirmed' AND v_order.stock_reserved IS NOT TRUE THEN
    PERFORM private.reserve_order_stock(v_order.id, v_uid);
    v_order.stock_reserved := true;
  END IF;

  IF v_to = 'cancelled' AND v_order.stock_reserved IS TRUE THEN
    PERFORM private.restore_order_stock(v_order.id, v_uid);
    v_order.stock_reserved := false;
  END IF;

  UPDATE public.orders o
  SET
    status = v_to,
    stock_reserved = v_order.stock_reserved,
    updated_at = now(),
    confirmed_at = CASE WHEN v_to = 'confirmed' THEN coalesce(o.confirmed_at, now()) ELSE o.confirmed_at END,
    completed_at = CASE WHEN v_to = 'completed' THEN coalesce(o.completed_at, now()) ELSE o.completed_at END,
    cancelled_at = CASE WHEN v_to = 'cancelled' THEN coalesce(o.cancelled_at, now()) ELSE o.cancelled_at END,
    cancel_reason = CASE WHEN v_to = 'cancelled' THEN v_reason ELSE o.cancel_reason END
  WHERE o.id = v_order.id;

  INSERT INTO public.order_status_events (
    order_id, from_status, to_status, actor_user_id, actor_kind, reason
  ) VALUES (
    v_order.id, v_from, v_to, v_uid, 'admin', v_reason
  );

  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'status', v_to,
    'from_status', v_from,
    'stock_reserved', v_order.stock_reserved,
    'idempotent_replay', false
  );
END;
$$;

-- Cron oficial. Nunca UPDATE cron.job.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.unschedule('expire-catalog-payments');
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_function THEN NULL;
  WHEN undefined_file THEN NULL;
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron no disponible en este entorno: %', SQLERRM;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'expire-catalog-payments',
    '*/5 * * * *',
    $cron$SELECT public.expire_catalog_payments()$cron$
  );
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'cron.schedule no disponible; expire_catalog_payments queda invocable por service_role';
  WHEN OTHERS THEN
    RAISE NOTICE 'no se programó expire-catalog-payments: %', SQLERRM;
END $$;
