-- =============================================================================
-- Stage 2 — Baseline de aplicación para instalaciones nuevas / Supabase local
-- =============================================================================
-- Clasificación: reproducible (greenfield). NO reescribe el historial remoto.
--
-- Contexto:
-- - El esquema productivo nació de scripts manuales (supabase/sql) + migraciones.
-- - Este archivo se registra como versión 20250101000000 en schema_migrations.
-- - En producción esa versión YA figura como aplicada; este contenido NO se
--   re-ejecuta allí. Solo gobierna `supabase db reset` / bases vacías.
-- - Objetos de auth/storage/realtime/extensions del stack Supabase se crean
--   por la plataforma local y NO se versionan aquí (administrado por Supabase).
--
-- Idempotencia: CREATE IF NOT EXISTS / DROP POLICY IF EXISTS / ON CONFLICT.
-- Las policies amplias de panel se reemplazan por Stage 0 y Stage 1.
-- =============================================================================

-- ========== CORE TABLES ==========
CREATE TABLE IF NOT EXISTS public.categories (
  id serial PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.products (
  id serial PRIMARY KEY,
  name text NOT NULL,
  category_id integer REFERENCES public.categories(id) ON DELETE SET NULL,
  brand text,
  color text,
  purchase_price numeric(10, 2),
  sale_price numeric(10, 2) NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  min_stock integer NOT NULL DEFAULT 0,
  image_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  discount_percentage numeric DEFAULT 0,
  visible_in_catalog boolean DEFAULT true,
  catalog_badge text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.customers (
  id serial PRIMARY KEY,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.sales (
  id serial PRIMARY KEY,
  sale_date timestamptz NOT NULL DEFAULT now(),
  total numeric(10, 2) NOT NULL DEFAULT 0,
  payment_method text,
  payment_breakdown jsonb,
  customer_name text,
  customer_id integer REFERENCES public.customers(id) ON DELETE SET NULL,
  notes text,
  receipt_url text,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- sale_items: columnas alineadas con los RPC de ventas (product_name/subtotal).
-- product_id es nullable para líneas de combo.
CREATE TABLE IF NOT EXISTS public.sale_items (
  id serial PRIMARY KEY,
  sale_id integer NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id integer REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(10, 2) NOT NULL DEFAULT 0,
  subtotal numeric(10, 2) NOT NULL DEFAULT 0,
  discount_percentage numeric(5, 2) DEFAULT 0,
  combo_id integer
);

CREATE TABLE IF NOT EXISTS public.combos (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  sale_price numeric NOT NULL CHECK (sale_price > 0),
  image_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.combo_items (
  id serial PRIMARY KEY,
  combo_id integer NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
  product_id integer NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  UNIQUE (combo_id, product_id)
);

-- FK de combo_id en sale_items (combos puede crearse en el mismo script).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sale_items_combo_id_fkey'
  ) THEN
    ALTER TABLE public.sale_items
      ADD CONSTRAINT sale_items_combo_id_fkey
      FOREIGN KEY (combo_id) REFERENCES public.combos(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  date date NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  amount numeric(10, 2) NOT NULL,
  payment_method text NOT NULL,
  receipt_url text,
  notes text,
  user_id uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Históricamente en supabase/sql (manual). Requerido por dashboard_finance_kpis.
CREATE TABLE IF NOT EXISTS public.incomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  type text NOT NULL CHECK (type IN ('regalo', 'donacion', 'ventas_anteriores', 'otro')),
  description text,
  notes text,
  created_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Históricamente en supabase/sql (manual). Referenciado por RPC de ventas.
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  product_id integer NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('sale', 'purchase', 'adjustment')),
  quantity integer NOT NULL,
  reference_type text,
  reference_id bigint,
  notes text,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.coupons (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  code text NOT NULL,
  discount_percentage integer NOT NULL CHECK (
    discount_percentage >= 0 AND discount_percentage <= 100
  ),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_upper_key
  ON public.coupons (upper(trim(code)));

-- Passkeys: tablas existentes en prod; funcionalidad contenida (403) en app.
-- Se versionan para paridad estructural y grants de Stage 1, no para reactivar.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'passkey_audit_event'
  ) THEN
    CREATE TYPE public.passkey_audit_event AS ENUM (
      'registration_started', 'registration_completed', 'registration_failed',
      'authentication_started', 'authentication_completed', 'authentication_failed',
      'passkey_removed', 'passkey_updated', 'rate_limit_exceeded',
      'challenge_expired', 'counter_mismatch'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.passkey_credentials (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  webauthn_user_id text NOT NULL,
  public_key bytea NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  device_type varchar(32) NOT NULL CHECK (device_type IN ('singleDevice', 'multiDevice')),
  backed_up boolean NOT NULL DEFAULT false,
  transports text[],
  authenticator_name varchar(255),
  aaguid varchar(36),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  CONSTRAINT unique_credential_per_user UNIQUE (id, user_id)
);

CREATE TABLE IF NOT EXISTS public.passkey_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  webauthn_user_id text,
  type varchar(20) NOT NULL CHECK (type IN ('registration', 'authentication')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.passkey_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  identifier_type varchar(10) NOT NULL CHECK (identifier_type IN ('ip', 'email')),
  endpoint varchar(50) NOT NULL,
  attempt_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_rate_limit_window
    UNIQUE (identifier, identifier_type, endpoint, window_start)
);

CREATE TABLE IF NOT EXISTS public.passkey_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type public.passkey_audit_event NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  credential_id text,
  email text,
  ip_address inet,
  user_agent text,
  origin text,
  metadata jsonb,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== INDEXES (app) ==========
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);
CREATE INDEX IF NOT EXISTS idx_sales_date ON public.sales(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON public.sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_combo_items_combo ON public.combo_items(combo_id);
CREATE INDEX IF NOT EXISTS idx_combos_active ON public.combos(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_incomes_user_date ON public.incomes(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_incomes_type ON public.incomes(type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS expenses_date_idx ON public.expenses(date DESC);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON public.expenses(category);
CREATE INDEX IF NOT EXISTS expenses_user_id_idx ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_passkey_credentials_user_id ON public.passkey_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_passkey_challenges_expires_at ON public.passkey_challenges(expires_at);
CREATE INDEX IF NOT EXISTS idx_passkey_challenges_challenge ON public.passkey_challenges(challenge);
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
  ON public.passkey_rate_limits(identifier, identifier_type, endpoint, window_start);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.passkey_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON public.passkey_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.passkey_audit_log(created_at);

-- ========== HELPER FUNCTIONS (legacy; Stage 1 endurece search_path) ==========
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_stock_on_sale()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.products
    SET stock = stock - NEW.quantity
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Passkey helpers (sin superficie pública; Stage 1 revoca EXECUTE a anon/auth).
CREATE OR REPLACE FUNCTION public.cleanup_expired_passkey_challenges()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.passkey_challenges WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_passkey_rate_limit(
  p_identifier text,
  p_identifier_type varchar(10),
  p_endpoint varchar(50),
  p_max_attempts integer DEFAULT 10,
  p_window_minutes integer DEFAULT 1
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_current_count integer;
BEGIN
  v_window_start := date_trunc('minute', now());
  INSERT INTO public.passkey_rate_limits (
    identifier, identifier_type, endpoint, window_start, attempt_count
  )
  VALUES (p_identifier, p_identifier_type, p_endpoint, v_window_start, 1)
  ON CONFLICT (identifier, identifier_type, endpoint, window_start)
  DO UPDATE SET attempt_count = public.passkey_rate_limits.attempt_count + 1
  RETURNING attempt_count INTO v_current_count;
  RETURN v_current_count > p_max_attempts;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_passkey_audit_event(
  p_event_type public.passkey_audit_event,
  p_user_id uuid DEFAULT NULL,
  p_credential_id text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_origin text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.passkey_audit_log (
    event_type, user_id, credential_id, email, ip_address,
    user_agent, origin, metadata, error_code, error_message
  )
  VALUES (
    p_event_type, p_user_id, p_credential_id, p_email, p_ip_address,
    p_user_agent, p_origin, p_metadata, p_error_code, p_error_message
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ========== GRANTS base (Data API) ==========
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;

-- ========== RLS base (panel; Stage 0/1 redefinen) ==========
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passkey_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passkey_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passkey_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passkey_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can manage products" ON public.products;
CREATE POLICY "Authenticated can manage products"
  ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can manage categories" ON public.categories;
CREATE POLICY "Authenticated can manage categories"
  ON public.categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can manage sales" ON public.sales;
CREATE POLICY "Authenticated can manage sales"
  ON public.sales FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can manage sale_items" ON public.sale_items;
CREATE POLICY "Authenticated can manage sale_items"
  ON public.sale_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated manage combos" ON public.combos;
CREATE POLICY "Authenticated manage combos"
  ON public.combos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated manage combo_items" ON public.combo_items;
CREATE POLICY "Authenticated manage combo_items"
  ON public.combo_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can manage expenses" ON public.expenses;
CREATE POLICY "Authenticated can manage expenses"
  ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Usuarios autenticados pueden gestionar clientes" ON public.customers;
CREATE POLICY "Usuarios autenticados pueden gestionar clientes"
  ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can manage incomes" ON public.incomes;
CREATE POLICY "Authenticated can manage incomes"
  ON public.incomes FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can manage stock_movements" ON public.stock_movements;
CREATE POLICY "Authenticated can manage stock_movements"
  ON public.stock_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Autenticados gestionan cupones" ON public.coupons;
CREATE POLICY "Autenticados gestionan cupones"
  ON public.coupons FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Cupones activos son legibles por anon" ON public.coupons;
CREATE POLICY "Cupones activos son legibles por anon"
  ON public.coupons FOR SELECT TO anon USING (is_active = true);

-- ========== Storage bucket receipts (Stage 0 lo vuelve privado) ==========
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;
