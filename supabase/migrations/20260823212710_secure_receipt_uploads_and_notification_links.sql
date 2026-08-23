-- Direct, signed receipt uploads and one-time cross-device notification links.

CREATE TABLE public.payment_receipt_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.order_payments(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  expected_mime text NOT NULL CHECK (
    expected_mime IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
  ),
  expires_at timestamptz NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at),
  CHECK (completed_at IS NULL OR completed_at >= created_at)
);

CREATE INDEX payment_receipt_uploads_expired_idx
  ON public.payment_receipt_uploads (expires_at)
  WHERE completed_at IS NULL;
CREATE INDEX payment_receipt_uploads_payment_id_idx
  ON public.payment_receipt_uploads (payment_id);

ALTER TABLE public.payment_receipt_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payment_receipt_uploads FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_receipt_uploads TO service_role;

CREATE TABLE public.order_notification_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (char_length(token_hash) = 64),
  kind text NOT NULL CHECK (char_length(kind) BETWEEN 1 AND 48),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE INDEX order_notification_links_order_id_idx
  ON public.order_notification_links (order_id);
CREATE INDEX order_notification_links_active_expiry_idx
  ON public.order_notification_links (expires_at)
  WHERE redeemed_at IS NULL AND revoked_at IS NULL;

ALTER TABLE public.order_notification_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_notification_links FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.order_notification_links TO service_role;

CREATE TABLE public.order_follow_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (char_length(token_hash) = 64),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  can_pay boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE INDEX order_follow_sessions_order_id_idx ON public.order_follow_sessions (order_id);
CREATE INDEX order_follow_sessions_active_expiry_idx
  ON public.order_follow_sessions (expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.order_follow_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_follow_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.order_follow_sessions TO service_role;

CREATE OR REPLACE FUNCTION private.receipt_mime_for_extension(p_extension text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_ext text := lower(trim(coalesce(p_extension, '')));
BEGIN
  IF v_ext = 'jpeg' THEN v_ext := 'jpg'; END IF;
  RETURN CASE v_ext
    WHEN 'jpg' THEN 'image/jpeg'
    WHEN 'png' THEN 'image/png'
    WHEN 'webp' THEN 'image/webp'
    WHEN 'pdf' THEN 'application/pdf'
    ELSE NULL
  END;
END;
$$;

REVOKE ALL ON FUNCTION private.receipt_mime_for_extension(text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.prepare_receipt_upload(
  p_payment_id uuid,
  p_extension text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_mime text := private.receipt_mime_for_extension(p_extension);
  v_ext text := lower(trim(coalesce(p_extension, '')));
  v_path text;
  v_exp timestamptz := now() + interval '2 hours';
BEGIN
  IF v_mime IS NULL THEN
    RAISE EXCEPTION 'invalid_receipt_type' USING ERRCODE = '23514';
  END IF;
  IF v_ext = 'jpeg' THEN v_ext := 'jpg'; END IF;
  v_path := p_payment_id::text || '/' || encode(extensions.gen_random_bytes(16), 'hex') || '.' || v_ext;
  INSERT INTO public.payment_receipt_uploads (payment_id, storage_path, expected_mime, expires_at)
  VALUES (p_payment_id, v_path, v_mime, v_exp);
  RETURN jsonb_build_object(
    'storage_path', v_path,
    'expected_mime', v_mime,
    'expires_at', v_exp
  );
END;
$$;

REVOKE ALL ON FUNCTION private.prepare_receipt_upload(uuid, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.complete_receipt_upload(
  p_payment_id uuid,
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
  v_upload public.payment_receipt_uploads%ROWTYPE;
BEGIN
  SELECT * INTO v_upload
  FROM public.payment_receipt_uploads
  WHERE payment_id = p_payment_id AND storage_path = p_storage_path
  FOR UPDATE;
  IF NOT FOUND OR v_upload.completed_at IS NOT NULL OR v_upload.expires_at <= now() THEN
    RAISE EXCEPTION 'invalid_receipt_upload' USING ERRCODE = '42501';
  END IF;
  IF p_mime_type <> v_upload.expected_mime THEN
    RAISE EXCEPTION 'invalid_receipt_type' USING ERRCODE = '23514';
  END IF;
  IF p_byte_size IS NULL OR p_byte_size <= 0 OR p_byte_size > 5242880 THEN
    RAISE EXCEPTION 'invalid_receipt_size' USING ERRCODE = '23514';
  END IF;
  IF p_sha256 IS NULL OR p_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_receipt_hash' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.payment_receipts (payment_id, storage_path, mime_type, byte_size, sha256)
  VALUES (p_payment_id, p_storage_path, p_mime_type, p_byte_size, p_sha256)
  ON CONFLICT (payment_id) DO UPDATE SET
    storage_path = EXCLUDED.storage_path,
    mime_type = EXCLUDED.mime_type,
    byte_size = EXCLUDED.byte_size,
    sha256 = EXCLUDED.sha256,
    uploaded_at = now();

  UPDATE public.payment_receipt_uploads
  SET completed_at = now()
  WHERE id = v_upload.id;
  UPDATE public.order_payments
  SET status = 'requires_review', updated_at = now()
  WHERE id = p_payment_id AND status IN ('pending', 'requires_review');
  INSERT INTO public.payment_events (
    payment_id, provider_event_id, event_type, normalized_status, payload_hash, processing_result
  ) VALUES (
    p_payment_id,
    'receipt:' || p_payment_id::text || ':' || p_sha256,
    'receipt.uploaded',
    'requires_review',
    p_sha256,
    'accepted'
  ) ON CONFLICT (provider_event_id) DO NOTHING;
  RETURN jsonb_build_object('status', 'requires_review', 'has_receipt', true);
END;
$$;

REVOKE ALL ON FUNCTION private.complete_receipt_upload(uuid, text, text, integer, text)
  FROM PUBLIC, anon, authenticated;

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
BEGIN
  v_order_id := private.resolve_order_access(p_access_capability);
  SELECT * INTO v_pay FROM public.order_payments
  WHERE order_id = v_order_id ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND OR v_pay.method <> 'bank_transfer' OR v_pay.status NOT IN ('pending', 'requires_review') THEN
    RAISE EXCEPTION 'invalid_payment_status' USING ERRCODE = '23514';
  END IF;
  RETURN private.prepare_receipt_upload(v_pay.id, p_extension);
END;
$$;

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
BEGIN
  v_order_id := private.resolve_order_follow(p_order_number, p_follow_token, true);
  SELECT * INTO v_pay FROM public.order_payments
  WHERE order_id = v_order_id ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND OR v_pay.method <> 'bank_transfer' OR v_pay.status NOT IN ('pending', 'requires_review') THEN
    RAISE EXCEPTION 'invalid_payment_status' USING ERRCODE = '23514';
  END IF;
  RETURN private.prepare_receipt_upload(v_pay.id, p_extension);
END;
$$;

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
  SELECT * INTO v_pay FROM public.order_payments
  WHERE order_id = v_order_id ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR v_pay.method <> 'bank_transfer' OR v_pay.status NOT IN ('pending', 'requires_review') THEN
    RAISE EXCEPTION 'invalid_payment_status' USING ERRCODE = '23514';
  END IF;
  RETURN private.complete_receipt_upload(v_pay.id, p_storage_path, p_mime_type, p_byte_size, p_sha256);
END;
$$;

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
  SELECT * INTO v_pay FROM public.order_payments
  WHERE order_id = v_order_id ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR v_pay.method <> 'bank_transfer' OR v_pay.status NOT IN ('pending', 'requires_review') THEN
    RAISE EXCEPTION 'invalid_payment_status' USING ERRCODE = '23514';
  END IF;
  RETURN private.complete_receipt_upload(v_pay.id, p_storage_path, p_mime_type, p_byte_size, p_sha256);
END;
$$;

-- Grants are repeated deliberately after CREATE OR REPLACE for an auditable API boundary.
REVOKE ALL ON FUNCTION public.prepare_transfer_receipt(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_transfer_receipt(text, text) TO service_role;
REVOKE ALL ON FUNCTION public.prepare_transfer_receipt_follow(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_transfer_receipt_follow(text, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.complete_transfer_receipt(text, text, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_transfer_receipt(text, text, text, integer, text) TO service_role;
REVOKE ALL ON FUNCTION public.complete_transfer_receipt_follow(text, text, text, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_transfer_receipt_follow(text, text, text, text, integer, text) TO service_role;

CREATE OR REPLACE FUNCTION public.create_order_notification_link(
  p_order_number text,
  p_kind text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_id uuid;
  v_plain text;
  v_exp timestamptz := now() + interval '7 days';
  v_kind text := lower(trim(coalesce(p_kind, 'status')));
BEGIN
  IF btrim(coalesce(p_order_number, '')) !~ '^IL-[0-9]{6,}$' OR char_length(v_kind) NOT BETWEEN 1 AND 48 THEN
    RAISE EXCEPTION 'invalid_notification_link' USING ERRCODE = '23514';
  END IF;
  SELECT id INTO v_order_id FROM public.orders WHERE order_number = btrim(p_order_number);
  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;
  v_plain := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.order_notification_links (order_id, token_hash, kind, expires_at)
  VALUES (v_order_id, private.hash_order_access(v_plain), v_kind, v_exp);
  RETURN jsonb_build_object('token', v_plain, 'expires_at', v_exp);
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_notification_link(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_notification_link(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.redeem_order_notification_link(
  p_order_number text,
  p_plain text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_link public.order_notification_links%ROWTYPE;
  v_session text;
  v_exp timestamptz := now() + interval '30 days';
BEGIN
  IF char_length(trim(coalesce(p_plain, ''))) < 32 THEN
    RAISE EXCEPTION 'invalid_notification_link' USING ERRCODE = '42501';
  END IF;
  SELECT l.* INTO v_link
  FROM public.order_notification_links l
  INNER JOIN public.orders o ON o.id = l.order_id
  WHERE l.token_hash = private.hash_order_access(trim(p_plain))
    AND o.order_number = btrim(p_order_number)
    AND l.redeemed_at IS NULL
    AND l.revoked_at IS NULL
    AND l.expires_at > now()
  FOR UPDATE OF l;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_notification_link' USING ERRCODE = '42501';
  END IF;
  v_session := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.order_follow_sessions (order_id, token_hash, expires_at, can_pay)
  VALUES (v_link.order_id, private.hash_order_access(v_session), v_exp, true);
  UPDATE public.order_notification_links SET redeemed_at = now() WHERE id = v_link.id;
  RETURN jsonb_build_object('follow_token', v_session, 'expires_at', v_exp);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_order_notification_link(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_order_notification_link(text, text) TO service_role;

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
  v_session_id uuid;
BEGIN
  IF p_plain IS NULL OR char_length(trim(p_plain)) < 32
    OR p_order_number IS NULL OR btrim(p_order_number) !~ '^IL-[0-9]{6,}$' THEN
    RAISE EXCEPTION 'invalid_follow_token' USING ERRCODE = '42501';
  END IF;
  v_hash := private.hash_order_access(trim(p_plain));
  SELECT t.order_id, t.can_pay INTO v_order_id, v_can_pay
  FROM public.order_follow_tokens t
  INNER JOIN public.orders o ON o.id = t.order_id
  WHERE t.token_hash = v_hash AND o.order_number = btrim(p_order_number)
    AND t.revoked_at IS NULL AND t.expires_at > now();
  IF v_order_id IS NOT NULL THEN
    UPDATE public.order_follow_tokens SET last_used_at = now() WHERE order_id = v_order_id;
  ELSE
    SELECT s.id, s.order_id, s.can_pay INTO v_session_id, v_order_id, v_can_pay
    FROM public.order_follow_sessions s
    INNER JOIN public.orders o ON o.id = s.order_id
    WHERE s.token_hash = v_hash AND o.order_number = btrim(p_order_number)
      AND s.revoked_at IS NULL AND s.expires_at > now();
    IF v_session_id IS NOT NULL THEN
      UPDATE public.order_follow_sessions SET last_used_at = now() WHERE id = v_session_id;
    END IF;
  END IF;
  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'invalid_follow_token' USING ERRCODE = '42501';
  END IF;
  IF p_require_pay AND v_can_pay IS NOT TRUE THEN
    RAISE EXCEPTION 'follow_pay_not_allowed' USING ERRCODE = '42501';
  END IF;
  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION private.resolve_order_follow(text, text, boolean)
  FROM PUBLIC, anon, authenticated;
