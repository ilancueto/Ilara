-- =============================================================================
-- Stage 6.1 — Pedidos desde el catálogo
-- =============================================================================
-- Forward-only. Sin envíos/logística (Stage 7).
-- - orders / order_items / order_status_events
-- - Precios autoritativos de catálogo (descuento producto + cupón revalidado)
-- - pending NO descuenta stock; confirmed reserva; cancel restaura si reservó
-- - Anon: sólo EXECUTE create_catalog_order (sin SELECT en tablas)
-- - Admin: SELECT RLS + EXECUTE transition_catalog_order
-- =============================================================================

-- ─── Secuencia legible ───────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.catalog_order_number_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

-- ─── Tablas ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')),
  channel text NOT NULL DEFAULT 'catalog'
    CHECK (channel IN ('catalog')),
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL CHECK (char_length(request_fingerprint) = 32),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  notes text,
  subtotal numeric(12, 2) NOT NULL CHECK (subtotal >= 0),
  discount_total numeric(12, 2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
  total numeric(12, 2) NOT NULL CHECK (total >= 0),
  coupon_code text,
  coupon_discount_percentage integer
    CHECK (
      coupon_discount_percentage IS NULL
      OR (coupon_discount_percentage >= 0 AND coupon_discount_percentage <= 100)
    ),
  stock_reserved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cancel_reason text,
  CONSTRAINT orders_order_number_key UNIQUE (order_number),
  CONSTRAINT orders_idempotency_key_key UNIQUE (idempotency_key),
  CONSTRAINT orders_total_consistency CHECK (total = subtotal - discount_total),
  CONSTRAINT orders_customer_name_len CHECK (char_length(customer_name) BETWEEN 1 AND 80),
  CONSTRAINT orders_customer_phone_len CHECK (char_length(customer_phone) BETWEEN 8 AND 20),
  CONSTRAINT orders_notes_len CHECK (notes IS NULL OR char_length(notes) <= 500),
  CONSTRAINT orders_cancel_reason_len CHECK (cancel_reason IS NULL OR char_length(cancel_reason) <= 300)
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id bigserial PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  line_type text NOT NULL CHECK (line_type IN ('product', 'combo')),
  product_id integer REFERENCES public.products(id) ON DELETE SET NULL,
  product_id_snapshot integer,
  combo_id integer REFERENCES public.combos(id) ON DELETE SET NULL,
  name_snapshot text NOT NULL,
  variant_snapshot text,
  combo_components_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  quantity integer NOT NULL CHECK (quantity > 0 AND quantity <= 99),
  unit_price numeric(12, 2) NOT NULL CHECK (unit_price >= 0),
  discount_percentage numeric(5, 2) NOT NULL DEFAULT 0
    CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  line_subtotal numeric(12, 2) NOT NULL CHECK (line_subtotal >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT order_items_type_refs CHECK (
    (line_type = 'product' AND product_id_snapshot IS NOT NULL AND combo_id IS NULL)
    OR (line_type = 'combo' AND product_id_snapshot IS NULL AND combo_id IS NOT NULL)
  )
);

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.prevent_reserved_order_product_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.orders o
    INNER JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.stock_reserved IS TRUE
      AND o.status IN ('confirmed', 'preparing', 'ready')
      AND (
        oi.product_id_snapshot = OLD.id
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(oi.combo_components_snapshot) AS component
          WHERE (component->>'product_id') ~ '^[0-9]+$'
            AND (component->>'product_id')::integer = OLD.id
        )
      )
  ) THEN
    RAISE EXCEPTION 'product_reserved_by_order'
      USING ERRCODE = '23503',
      DETAIL = format('product_id=%s', OLD.id);
  END IF;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_reserved_order_product_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_reserved_order_product_delete ON public.products;
CREATE TRIGGER prevent_reserved_order_product_delete
BEFORE DELETE ON public.products
FOR EACH ROW
EXECUTE FUNCTION private.prevent_reserved_order_product_delete();

CREATE TABLE IF NOT EXISTS public.order_status_events (
  id bigserial PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_kind text NOT NULL DEFAULT 'system'
    CHECK (actor_kind IN ('system', 'admin', 'public')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_status_events_reason_len CHECK (reason IS NULL OR char_length(reason) <= 300)
);

CREATE INDEX IF NOT EXISTS orders_status_created_idx
  ON public.orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_created_at_idx
  ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_customer_phone_created_idx
  ON public.orders (customer_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_created_by_idx
  ON public.orders (created_by);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx
  ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_product_id_idx
  ON public.order_items (product_id);
CREATE INDEX IF NOT EXISTS order_items_combo_id_idx
  ON public.order_items (combo_id);
CREATE INDEX IF NOT EXISTS order_status_events_order_id_idx
  ON public.order_status_events (order_id, created_at);
CREATE INDEX IF NOT EXISTS order_status_events_actor_user_id_idx
  ON public.order_status_events (actor_user_id);

COMMENT ON TABLE public.orders IS
  'Stage 6.1 pedidos de catálogo. Sin superficie anónima de lectura. Stock en confirmación.';
COMMENT ON TABLE public.order_items IS
  'Líneas con snapshots de nombre/precio/composición. No confiar en catálogo vivo para historial.';
COMMENT ON TABLE public.order_status_events IS
  'Historial auditable de transiciones de pedido.';

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.orders FROM PUBLIC;
REVOKE ALL ON TABLE public.orders FROM anon;
REVOKE ALL ON TABLE public.orders FROM authenticated;
REVOKE ALL ON TABLE public.order_items FROM PUBLIC;
REVOKE ALL ON TABLE public.order_items FROM anon;
REVOKE ALL ON TABLE public.order_items FROM authenticated;
REVOKE ALL ON TABLE public.order_status_events FROM PUBLIC;
REVOKE ALL ON TABLE public.order_status_events FROM anon;
REVOKE ALL ON TABLE public.order_status_events FROM authenticated;

-- Solo admin lee filas; mutaciones vía RPC DEFINER.
DROP POLICY IF EXISTS orders_select_admin ON public.orders;
CREATE POLICY orders_select_admin
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (public.is_app_admin());

DROP POLICY IF EXISTS order_items_select_admin ON public.order_items;
CREATE POLICY order_items_select_admin
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (public.is_app_admin());

DROP POLICY IF EXISTS order_status_events_select_admin ON public.order_status_events;
CREATE POLICY order_status_events_select_admin
  ON public.order_status_events
  FOR SELECT
  TO authenticated
  USING (public.is_app_admin());

GRANT SELECT ON TABLE public.orders TO authenticated;
GRANT SELECT ON TABLE public.order_items TO authenticated;
GRANT SELECT ON TABLE public.order_status_events TO authenticated;
-- Grants explícitos: desde 2026 Supabase deja de exponer objetos nuevos automáticamente.
-- service_role mantiene la superficie de mantenimiento/backup y continúa bypasseando RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.order_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.order_status_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.catalog_order_number_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.order_items_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.order_status_events_id_seq TO service_role;

-- ─── Helper: número legible ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.next_catalog_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_n bigint;
BEGIN
  v_n := nextval('public.catalog_order_number_seq');
  RETURN 'IL-' || lpad(v_n::text, 6, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_catalog_order_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_catalog_order_number() FROM anon;
REVOKE ALL ON FUNCTION public.next_catalog_order_number() FROM authenticated;

-- ─── create_catalog_order ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_catalog_order(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_idem text;
  v_name text;
  v_phone text;
  v_email text;
  v_notes text;
  v_coupon_code text;
  v_coupon_pct integer := 0;
  v_lines jsonb;
  v_existing public.orders%ROWTYPE;
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
  v_line_count integer;
  v_phone_count integer;
  v_request_fingerprint text;
  rec record;
  v_sort integer := 0;
  v_has_sm boolean;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '23514';
  END IF;

  v_idem := nullif(trim(coalesce(p_payload->>'idempotency_key', '')), '');
  IF v_idem IS NULL OR char_length(v_idem) < 16 OR char_length(v_idem) > 80 THEN
    RAISE EXCEPTION 'invalid_idempotency_key' USING ERRCODE = '23514';
  END IF;

  v_name := nullif(trim(coalesce(p_payload->>'customer_name', '')), '');
  IF v_name IS NULL OR char_length(v_name) > 80 THEN
    RAISE EXCEPTION 'invalid_customer_name' USING ERRCODE = '23514';
  END IF;

  -- Solo dígitos; 8–15 (AR móvil típico con 54…).
  v_phone := regexp_replace(coalesce(p_payload->>'customer_phone', ''), '[^0-9]', '', 'g');
  IF v_phone IS NULL OR char_length(v_phone) < 8 OR char_length(v_phone) > 15 THEN
    RAISE EXCEPTION 'invalid_customer_phone' USING ERRCODE = '23514';
  END IF;

  v_email := nullif(lower(trim(coalesce(p_payload->>'customer_email', ''))), '');
  IF v_email IS NOT NULL THEN
    IF char_length(v_email) > 120 OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
      RAISE EXCEPTION 'invalid_customer_email' USING ERRCODE = '23514';
    END IF;
  END IF;

  v_notes := nullif(trim(coalesce(p_payload->>'notes', '')), '');
  IF v_notes IS NOT NULL AND char_length(v_notes) > 500 THEN
    RAISE EXCEPTION 'invalid_notes' USING ERRCODE = '23514';
  END IF;

  -- Rechazar totales/precios del cliente (no se leen unit_price/total del payload).
  IF p_payload ? 'total' OR p_payload ? 'subtotal' OR p_payload ? 'unit_price' THEN
    RAISE EXCEPTION 'client_price_not_allowed' USING ERRCODE = '23514';
  END IF;

  v_lines := coalesce(p_payload->'lines', '[]'::jsonb);
  IF jsonb_typeof(v_lines) <> 'array' OR jsonb_array_length(v_lines) = 0 THEN
    RAISE EXCEPTION 'empty_lines' USING ERRCODE = '23514';
  END IF;
  IF jsonb_array_length(v_lines) > 40 THEN
    RAISE EXCEPTION 'too_many_lines' USING ERRCODE = '23514';
  END IF;

  v_coupon_code := nullif(upper(trim(coalesce(p_payload->>'coupon_code', ''))), '');
  v_request_fingerprint := md5(jsonb_build_object(
    'customer_name', v_name,
    'customer_phone', v_phone,
    'customer_email', v_email,
    'notes', v_notes,
    'coupon_code', v_coupon_code,
    'lines', v_lines
  )::text);

  -- Serializar reintentos con la misma clave para evitar la carrera SELECT/INSERT.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_idem, 0));

  SELECT * INTO v_existing
  FROM public.orders o
  WHERE o.idempotency_key = v_idem;

  IF FOUND THEN
    IF v_existing.request_fingerprint <> v_request_fingerprint THEN
      RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = '23514';
    END IF;

    RETURN jsonb_build_object(
      'order_id', v_existing.id,
      'order_number', v_existing.order_number,
      'status', v_existing.status,
      'subtotal', v_existing.subtotal,
      'discount_total', v_existing.discount_total,
      'total', v_existing.total,
      'created_at', v_existing.created_at,
      'idempotent_replay', true
    );
  END IF;

  -- Serializar por teléfono para que el límite sea correcto bajo concurrencia.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-order-phone:' || v_phone, 0)
  );

  -- Rate limit: máx 8 pedidos por teléfono en 1h.
  SELECT count(*)::integer INTO v_phone_count
  FROM public.orders o
  WHERE o.customer_phone = v_phone
    AND o.created_at > now() - interval '1 hour';
  IF v_phone_count >= 8 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = '54000';
  END IF;

  -- Cupón revalidado (activo).
  IF v_coupon_code IS NOT NULL THEN
    SELECT c.discount_percentage INTO v_coupon_pct
    FROM public.coupons c
    WHERE upper(trim(c.code)) = v_coupon_code
      AND c.is_active IS TRUE
    LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid_coupon' USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Validar líneas y calcular subtotal autoritativo (precio catálogo).
  FOR rec IN
    SELECT
      elem,
      coalesce(nullif(trim(elem->>'line_type'), ''), '') AS lt,
      CASE WHEN elem->>'product_id' ~ '^[0-9]+$' THEN (elem->>'product_id')::integer END AS pid,
      CASE WHEN elem->>'combo_id' ~ '^[0-9]+$' THEN (elem->>'combo_id')::integer END AS cid,
      CASE
        WHEN elem->>'quantity' ~ '^[0-9]+$' THEN (elem->>'quantity')::integer
        ELSE NULL
      END AS qty
    FROM jsonb_array_elements(v_lines) AS t(elem)
  LOOP
    IF rec.qty IS NULL OR rec.qty <= 0 OR rec.qty > 99 THEN
      RAISE EXCEPTION 'invalid_quantity' USING ERRCODE = '23514';
    END IF;

    IF rec.lt = 'product' THEN
      IF rec.pid IS NULL THEN
        RAISE EXCEPTION 'invalid_product_line' USING ERRCODE = '23514';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = rec.pid
          AND coalesce(p.visible_in_catalog, true) IS TRUE
          AND p.sale_price IS NOT NULL
          AND p.sale_price::numeric > 0
      ) THEN
        RAISE EXCEPTION 'product_not_available' USING ERRCODE = '23514';
      END IF;
    ELSIF rec.lt = 'combo' THEN
      IF rec.cid IS NULL THEN
        RAISE EXCEPTION 'invalid_combo' USING ERRCODE = '23514';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.combos c
        WHERE c.id = rec.cid
          AND c.is_active IS TRUE
          AND c.sale_price IS NOT NULL
          AND c.sale_price::numeric > 0
      ) THEN
        RAISE EXCEPTION 'combo_not_available' USING ERRCODE = '23514';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.combo_items ci WHERE ci.combo_id = rec.cid
      ) THEN
        RAISE EXCEPTION 'empty_combo' USING ERRCODE = '23514';
      END IF;
    ELSE
      RAISE EXCEPTION 'invalid_line_type' USING ERRCODE = '23514';
    END IF;
  END LOOP;

  SELECT COALESCE(SUM(x.line_sub), 0) INTO v_subtotal
  FROM (
    SELECT
      CASE
        WHEN (elem->>'line_type') = 'product' THEN
          round(
            (p.sale_price::numeric)
            * (1 - (coalesce(p.discount_percentage, 0)::numeric / 100.0))
          , 0) * (elem->>'quantity')::integer
        WHEN (elem->>'line_type') = 'combo' THEN
          round(c.sale_price::numeric, 0) * (elem->>'quantity')::integer
      END AS line_sub
    FROM jsonb_array_elements(v_lines) AS t(elem)
    LEFT JOIN public.products p
      ON (elem->>'line_type') = 'product' AND p.id = (elem->>'product_id')::integer
    LEFT JOIN public.combos c
      ON (elem->>'line_type') = 'combo' AND c.id = (elem->>'combo_id')::integer
  ) x;

  IF v_subtotal IS NULL OR v_subtotal <= 0 THEN
    RAISE EXCEPTION 'invalid_total' USING ERRCODE = '23514';
  END IF;

  IF v_coupon_pct > 0 THEN
    v_discount := round(v_subtotal * (v_coupon_pct::numeric / 100.0), 0);
  ELSE
    v_discount := 0;
  END IF;
  v_total := v_subtotal - v_discount;
  IF v_total < 0 THEN
    v_total := 0;
  END IF;

  v_order_number := public.next_catalog_order_number();

  INSERT INTO public.orders (
    order_number,
    status,
    channel,
    idempotency_key,
    request_fingerprint,
    customer_name,
    customer_phone,
    customer_email,
    notes,
    subtotal,
    discount_total,
    total,
    coupon_code,
    coupon_discount_percentage,
    stock_reserved,
    created_by
  ) VALUES (
    v_order_number,
    'pending',
    'catalog',
    v_idem,
    v_request_fingerprint,
    v_name,
    v_phone,
    v_email,
    v_notes,
    v_subtotal,
    v_discount,
    v_total,
    v_coupon_code,
    CASE WHEN v_coupon_code IS NULL THEN NULL ELSE v_coupon_pct END,
    false,
    v_uid
  )
  RETURNING id INTO v_order_id;

  -- Insertar líneas con snapshots.
  FOR rec IN
    SELECT
      elem,
      (elem->>'line_type') AS lt,
      CASE WHEN (elem->>'line_type') = 'product' THEN (elem->>'product_id')::integer END AS pid,
      CASE WHEN (elem->>'line_type') = 'combo' THEN (elem->>'combo_id')::integer END AS cid,
      (elem->>'quantity')::integer AS qty
    FROM jsonb_array_elements(v_lines) AS t(elem)
  LOOP
    v_sort := v_sort + 1;
    IF rec.lt = 'product' THEN
      INSERT INTO public.order_items (
        order_id, line_type, product_id, product_id_snapshot, combo_id,
        name_snapshot, variant_snapshot, combo_components_snapshot,
        quantity, unit_price, discount_percentage, line_subtotal, sort_order
      )
      SELECT
        v_order_id,
        'product',
        p.id,
        p.id,
        NULL,
        p.name,
        nullif(trim(concat_ws(' · ', nullif(p.brand, ''), nullif(p.color, ''))), ''),
        '[]'::jsonb,
        rec.qty,
        round(
          (p.sale_price::numeric)
          * (1 - (coalesce(p.discount_percentage, 0)::numeric / 100.0))
        , 0),
        coalesce(p.discount_percentage, 0)::numeric,
        round(
          (p.sale_price::numeric)
          * (1 - (coalesce(p.discount_percentage, 0)::numeric / 100.0))
        , 0) * rec.qty,
        v_sort
      FROM public.products p
      WHERE p.id = rec.pid;
    ELSE
      INSERT INTO public.order_items (
        order_id, line_type, product_id, product_id_snapshot, combo_id,
        name_snapshot, variant_snapshot, combo_components_snapshot,
        quantity, unit_price, discount_percentage, line_subtotal, sort_order
      )
      SELECT
        v_order_id,
        'combo',
        NULL,
        NULL,
        c.id,
        c.name,
        NULL,
        coalesce((
          SELECT jsonb_agg(
            jsonb_build_object(
              'product_id', ci.product_id,
              'product_name', pr.name,
              'quantity', ci.quantity
            )
            ORDER BY ci.id
          )
          FROM public.combo_items ci
          INNER JOIN public.products pr ON pr.id = ci.product_id
          WHERE ci.combo_id = c.id
        ), '[]'::jsonb),
        rec.qty,
        round(c.sale_price::numeric, 0),
        0,
        round(c.sale_price::numeric, 0) * rec.qty,
        v_sort
      FROM public.combos c
      WHERE c.id = rec.cid;
    END IF;
  END LOOP;

  INSERT INTO public.order_status_events (
    order_id, from_status, to_status, actor_user_id, actor_kind, reason
  ) VALUES (
    v_order_id, NULL, 'pending', v_uid,
    CASE WHEN v_uid IS NULL THEN 'public' ELSE 'admin' END,
    'created'
  );

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'status', 'pending',
    'subtotal', v_subtotal,
    'discount_total', v_discount,
    'total', v_total,
    'created_at', now(),
    'idempotent_replay', false
  );
END;
$$;

COMMENT ON FUNCTION public.create_catalog_order(jsonb) IS
  'Stage 6.1: crea pedido pending con precios de catálogo autoritativos. Idempotente. Sin descontar stock.';

REVOKE ALL ON FUNCTION public.create_catalog_order(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_catalog_order(jsonb) TO anon, authenticated;

-- ─── transition_catalog_order ────────────────────────────────────────────────
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
  v_has_sm boolean;
  rec record;
  v_allowed boolean := false;
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

  SELECT * INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_from := v_order.status;

  -- Idempotencia: misma transición ya aplicada.
  IF v_from = v_to THEN
    RETURN jsonb_build_object(
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'status', v_order.status,
      'stock_reserved', v_order.stock_reserved,
      'idempotent_replay', true
    );
  END IF;

  -- Máquina de estados.
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

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stock_movements'
  ) INTO v_has_sm;

  -- Confirmar: reservar stock atómicamente (una sola vez).
  IF v_to = 'confirmed' AND v_order.stock_reserved IS NOT TRUE THEN
    IF EXISTS (
      WITH expanded AS (
        SELECT oi.product_id_snapshot AS product_id
        FROM public.order_items oi
        WHERE oi.order_id = v_order.id
          AND oi.line_type = 'product'
        UNION ALL
        SELECT (comp->>'product_id')::integer AS product_id
        FROM public.order_items oi
        CROSS JOIN LATERAL jsonb_array_elements(oi.combo_components_snapshot) AS comp
        WHERE oi.order_id = v_order.id
          AND oi.line_type = 'combo'
      )
      SELECT 1
      FROM expanded e
      LEFT JOIN public.products p ON p.id = e.product_id
      WHERE e.product_id IS NULL OR p.id IS NULL
    ) THEN
      RAISE EXCEPTION 'product_not_available' USING ERRCODE = '23514';
    END IF;

    FOR rec IN
      WITH expanded AS (
        SELECT oi.product_id_snapshot AS product_id, oi.quantity::bigint AS qty
        FROM public.order_items oi
        WHERE oi.order_id = v_order.id
          AND oi.line_type = 'product'
        UNION ALL
        SELECT
          (comp->>'product_id')::integer AS product_id,
          (oi.quantity::bigint * (comp->>'quantity')::bigint) AS qty
        FROM public.order_items oi
        CROSS JOIN LATERAL jsonb_array_elements(oi.combo_components_snapshot) AS comp
        WHERE oi.order_id = v_order.id
          AND oi.line_type = 'combo'
      ),
      needed AS (
        SELECT product_id, sum(qty)::bigint AS qty
        FROM expanded
        WHERE product_id IS NOT NULL
        GROUP BY product_id
      )
      SELECT p.id AS product_id, p.stock, n.qty
      FROM needed n
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
    SET stock = p.stock - sub.qty,
        updated_at = now()
    FROM (
      WITH expanded AS (
        SELECT oi.product_id_snapshot AS product_id, oi.quantity::bigint AS qty
        FROM public.order_items oi
        WHERE oi.order_id = v_order.id
          AND oi.line_type = 'product'
        UNION ALL
        SELECT
          (comp->>'product_id')::integer AS product_id,
          (oi.quantity::bigint * (comp->>'quantity')::bigint) AS qty
        FROM public.order_items oi
        CROSS JOIN LATERAL jsonb_array_elements(oi.combo_components_snapshot) AS comp
        WHERE oi.order_id = v_order.id
          AND oi.line_type = 'combo'
      )
      SELECT product_id, sum(qty)::integer AS qty
      FROM expanded
      WHERE product_id IS NOT NULL
      GROUP BY product_id
    ) sub
    WHERE p.id = sub.product_id;

    IF v_has_sm THEN
      INSERT INTO public.stock_movements (
        product_id, type, quantity, reference_type, reference_id, notes, user_id
      )
      SELECT
        n.product_id,
        'sale',
        -n.qty,
        'order',
        NULL,
        'order:' || v_order.order_number,
        v_uid
      FROM (
        WITH expanded AS (
          SELECT oi.product_id_snapshot AS product_id, oi.quantity::bigint AS qty
          FROM public.order_items oi
          WHERE oi.order_id = v_order.id
            AND oi.line_type = 'product'
          UNION ALL
          SELECT
            (comp->>'product_id')::integer AS product_id,
            (oi.quantity::bigint * (comp->>'quantity')::bigint) AS qty
          FROM public.order_items oi
          CROSS JOIN LATERAL jsonb_array_elements(oi.combo_components_snapshot) AS comp
          WHERE oi.order_id = v_order.id
            AND oi.line_type = 'combo'
        )
        SELECT product_id, sum(qty)::integer AS qty
        FROM expanded
        WHERE product_id IS NOT NULL
        GROUP BY product_id
      ) n;
    END IF;

    v_order.stock_reserved := true;
  END IF;

  -- Cancelar: restaurar stock solo si estaba reservado.
  IF v_to = 'cancelled' AND v_order.stock_reserved IS TRUE THEN
    FOR rec IN
      WITH expanded AS (
        SELECT oi.product_id_snapshot AS product_id, oi.quantity::bigint AS qty
        FROM public.order_items oi
        WHERE oi.order_id = v_order.id
          AND oi.line_type = 'product'
        UNION ALL
        SELECT
          (comp->>'product_id')::integer AS product_id,
          (oi.quantity::bigint * (comp->>'quantity')::bigint) AS qty
        FROM public.order_items oi
        CROSS JOIN LATERAL jsonb_array_elements(oi.combo_components_snapshot) AS comp
        WHERE oi.order_id = v_order.id
          AND oi.line_type = 'combo'
      ),
      needed AS (
        SELECT product_id, sum(qty)::bigint AS qty
        FROM expanded
        WHERE product_id IS NOT NULL
        GROUP BY product_id
      )
      SELECT p.id AS product_id, n.qty
      FROM needed n
      INNER JOIN public.products p ON p.id = n.product_id
      ORDER BY p.id
      FOR UPDATE OF p
    LOOP
      UPDATE public.products
      SET stock = stock + rec.qty,
          updated_at = now()
      WHERE id = rec.product_id;
    END LOOP;

    IF v_has_sm THEN
      INSERT INTO public.stock_movements (
        product_id, type, quantity, reference_type, reference_id, notes, user_id
      )
      SELECT
        n.product_id,
        'adjustment',
        n.qty,
        'order',
        NULL,
        'order_cancel:' || v_order.order_number,
        v_uid
      FROM (
        WITH expanded AS (
          SELECT oi.product_id_snapshot AS product_id, oi.quantity::bigint AS qty
          FROM public.order_items oi
          WHERE oi.order_id = v_order.id
            AND oi.line_type = 'product'
          UNION ALL
          SELECT
            (comp->>'product_id')::integer AS product_id,
            (oi.quantity::bigint * (comp->>'quantity')::bigint) AS qty
          FROM public.order_items oi
          CROSS JOIN LATERAL jsonb_array_elements(oi.combo_components_snapshot) AS comp
          WHERE oi.order_id = v_order.id
            AND oi.line_type = 'combo'
        )
        SELECT product_id, sum(qty)::integer AS qty
        FROM expanded
        WHERE product_id IS NOT NULL
        GROUP BY product_id
      ) n;
    END IF;

    v_order.stock_reserved := false;
  END IF;

  UPDATE public.orders o
  SET
    status = v_to,
    stock_reserved = v_order.stock_reserved,
    updated_at = now(),
    confirmed_at = CASE
      WHEN v_to = 'confirmed' THEN coalesce(o.confirmed_at, now())
      ELSE o.confirmed_at
    END,
    completed_at = CASE
      WHEN v_to = 'completed' THEN coalesce(o.completed_at, now())
      ELSE o.completed_at
    END,
    cancelled_at = CASE
      WHEN v_to = 'cancelled' THEN coalesce(o.cancelled_at, now())
      ELSE o.cancelled_at
    END,
    cancel_reason = CASE
      WHEN v_to = 'cancelled' THEN v_reason
      ELSE o.cancel_reason
    END
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

COMMENT ON FUNCTION public.transition_catalog_order(uuid, text, text) IS
  'Stage 6.1: transición de estado admin-only. Confirmar reserva stock; cancelar restaura si reservado.';

REVOKE ALL ON FUNCTION public.transition_catalog_order(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transition_catalog_order(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.transition_catalog_order(uuid, text, text) TO authenticated;
