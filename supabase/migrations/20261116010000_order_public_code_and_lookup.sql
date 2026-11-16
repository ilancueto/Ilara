-- =============================================================================
-- Código público de pedido ILARA-XXXXXX y búsqueda segura "Seguir mi pedido"
-- =============================================================================
-- Forward-only.
-- - Pedidos nuevos: ILARA- + 6 caracteres aleatorios (sin 0/O/1/I/L para no confundir).
--   Los pedidos existentes conservan IL-000xxx y siguen funcionando.
-- - Las funciones que validaban el formato aceptan ambos.
-- - verify_order_lookup: número de pedido + teléfono, con límite de intentos.
--   Solo service_role (lo llama una server action); anon no tiene acceso.
-- =============================================================================

-- ─── Formato válido de número de pedido (viejo y nuevo) ─────────────────────
CREATE OR REPLACE FUNCTION private.is_order_number(p_value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(btrim(p_value), '') ~ '^(IL-[0-9]{6,}|ILARA-[2-9A-HJKMNP-Z]{6})$';
$$;

REVOKE ALL ON FUNCTION private.is_order_number(text) FROM PUBLIC, anon, authenticated;

-- ─── Generador del código público ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.next_catalog_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- 31 símbolos: sin 0, 1, I, L, O → ~887 millones de combinaciones.
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_bytes bytea;
  v_code text;
  v_i int;
  v_try int := 0;
BEGIN
  LOOP
    v_try := v_try + 1;
    v_bytes := extensions.gen_random_bytes(6);
    v_code := 'ILARA-';
    FOR v_i IN 0..5 LOOP
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, v_i) % 31) + 1, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.order_number = v_code);
    IF v_try >= 20 THEN
      RAISE EXCEPTION 'order_number_exhausted' USING ERRCODE = '23505';
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.next_catalog_order_number() FROM PUBLIC, anon, authenticated;

-- ─── resolve_order_follow: igual que antes, acepta ambos formatos ───────────
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
    OR NOT private.is_order_number(p_order_number) THEN
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

-- ─── create_order_notification_link: igual que antes, acepta ambos formatos ─
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
  IF NOT private.is_order_number(p_order_number) OR char_length(v_kind) NOT BETWEEN 1 AND 48 THEN
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

-- ─── Intentos de búsqueda (para el límite) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_lookup_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_hash text NOT NULL CHECK (char_length(client_hash) BETWEEN 16 AND 128),
  order_number text CHECK (order_number IS NULL OR char_length(order_number) <= 32),
  succeeded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_lookup_attempts_client_idx
  ON public.order_lookup_attempts (client_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS order_lookup_attempts_order_idx
  ON public.order_lookup_attempts (order_number, created_at DESC);

ALTER TABLE public.order_lookup_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_lookup_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.order_lookup_attempts TO service_role;

COMMENT ON TABLE public.order_lookup_attempts IS
  'Intentos de "Seguir mi pedido" (número + teléfono). Solo para limitar intentos; se purga a los 2 días.';

-- ─── Verificación número + teléfono ─────────────────────────────────────────
-- Devuelve {ok:true} si el teléfono coincide (últimos 8 dígitos) con el del pedido.
-- Mismo resultado {ok:false, reason:'not_found'} si el pedido no existe o el teléfono no coincide.
-- Límites: 10 intentos por cliente cada 15 min; 8 intentos fallidos por pedido por hora.
CREATE OR REPLACE FUNCTION public.verify_order_lookup(
  p_order_number text,
  p_phone text,
  p_client_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_number text := upper(btrim(coalesce(p_order_number, '')));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_client text := btrim(coalesce(p_client_hash, ''));
  v_stored text;
  v_ok boolean := false;
BEGIN
  IF char_length(v_client) NOT BETWEEN 16 AND 128 THEN
    RAISE EXCEPTION 'invalid_client' USING ERRCODE = '22023';
  END IF;

  -- Serializa por cliente para que el conteo sea correcto con pedidos simultáneos.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('order-lookup:' || v_client, 0));

  DELETE FROM public.order_lookup_attempts WHERE created_at < now() - interval '2 days';

  IF (SELECT count(*) FROM public.order_lookup_attempts a
      WHERE a.client_hash = v_client AND a.created_at > now() - interval '15 minutes') >= 10
    OR (SELECT count(*) FROM public.order_lookup_attempts a
      WHERE a.order_number = v_number AND NOT a.succeeded
        AND a.created_at > now() - interval '1 hour') >= 8 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
  END IF;

  IF private.is_order_number(v_number) AND char_length(v_phone) >= 8 THEN
    SELECT regexp_replace(o.customer_phone, '[^0-9]', '', 'g') INTO v_stored
    FROM public.orders o WHERE o.order_number = v_number;
    v_ok := v_stored IS NOT NULL AND char_length(v_stored) >= 8 AND right(v_stored, 8) = right(v_phone, 8);
  END IF;

  INSERT INTO public.order_lookup_attempts (client_hash, order_number, succeeded)
  VALUES (v_client, left(v_number, 32), v_ok);

  IF v_ok THEN
    RETURN jsonb_build_object('ok', true, 'order_number', v_number);
  END IF;
  RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
END;
$$;

REVOKE ALL ON FUNCTION public.verify_order_lookup(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_order_lookup(text, text, text) TO service_role;
