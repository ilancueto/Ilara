-- Stage 2 — governance markers and safe structural parity (forward-only).
--
-- Production post-Stage1 ya tiene el esquema de aplicación. Esta migración:
-- 1) Reafirma índices FK faltantes detectados por advisors (performance INFO).
-- 2) Documenta la postura intencional de passkeys (RLS on, sin policies, sin grants).
-- 3) Es totalmente idempotente (IF NOT EXISTS / comentarios).
--
-- No modifica Stage 0/1. No reabre passkeys ni el rol vendedor.

-- Índices de FK sin cobertura (advisors performance: unindexed_foreign_keys).
-- No se eliminan índices "unused": un entorno fresco no tiene estadísticas.
CREATE INDEX IF NOT EXISTS idx_combo_items_product_id ON public.combo_items(product_id);
CREATE INDEX IF NOT EXISTS idx_customers_created_by ON public.customers(created_by);
CREATE INDEX IF NOT EXISTS idx_customers_updated_by ON public.customers(updated_by);
CREATE INDEX IF NOT EXISTS idx_expenses_updated_by ON public.expenses(updated_by);
CREATE INDEX IF NOT EXISTS idx_incomes_updated_by ON public.incomes(updated_by);
CREATE INDEX IF NOT EXISTS idx_incomes_user_id ON public.incomes(user_id);
CREATE INDEX IF NOT EXISTS idx_products_created_by ON public.products(created_by);
CREATE INDEX IF NOT EXISTS idx_products_updated_by ON public.products(updated_by);
CREATE INDEX IF NOT EXISTS idx_sales_created_by ON public.sales(created_by);
CREATE INDEX IF NOT EXISTS idx_sales_updated_by ON public.sales(updated_by);
CREATE INDEX IF NOT EXISTS idx_sale_items_combo_id ON public.sale_items(combo_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_user_id ON public.stock_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_updated_by ON public.user_roles(updated_by);
CREATE INDEX IF NOT EXISTS idx_passkey_credentials_webauthn_user_id
  ON public.passkey_credentials(webauthn_user_id);
CREATE INDEX IF NOT EXISTS idx_passkey_challenges_user_id
  ON public.passkey_challenges(user_id);
-- passkey_audit_log.created_at ya está cubierto por idx_audit_log_created_at.
-- B-tree puede recorrerse en ambos sentidos; no crear un índice DESC duplicado.

-- Passkeys: contenidas por decisión de negocio.
-- RLS habilitado + cero policies + REVOKE grants = denegación total vía Data API.
-- Advisors reportan rls_enabled_no_policy (INFO): intencional y documentado.
-- Producción puede conservar policies legacy de supabase/sql; se eliminan aquí.
DROP POLICY IF EXISTS "Users can view their own passkeys" ON public.passkey_credentials;
DROP POLICY IF EXISTS "Users can delete their own passkeys" ON public.passkey_credentials;
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.passkey_audit_log;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'passkey_credentials',
    'passkey_challenges',
    'passkey_rate_limits',
    'passkey_audit_log'
  ]
  LOOP
    IF to_regclass(format('public.%I', v_table)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
      EXECUTE format(
        'REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated',
        v_table
      );
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', v_table);
    END IF;
  END LOOP;
END $$;

-- Trigger de updated_at en products (presente en prod histórico; no dañino en local).
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.passkey_credentials IS
  'Stage2: passkeys deshabilitadas en producto. RLS on, sin policies, sin grants a anon/authenticated.';
COMMENT ON TABLE public.passkey_challenges IS
  'Stage2: passkeys deshabilitadas. Solo service_role / Edge Function interna si se reactivara.';
COMMENT ON TABLE public.passkey_rate_limits IS
  'Stage2: passkeys deshabilitadas. Sin superficie Data API.';
COMMENT ON TABLE public.passkey_audit_log IS
  'Stage2: passkeys deshabilitadas. Sin superficie Data API.';

-- Contrato de objetos de aplicación requeridos (falla el deploy si falta algo crítico).
DO $$
DECLARE
  v_required text[] := ARRAY[
    'categories', 'products', 'sales', 'sale_items', 'combos', 'combo_items',
    'expenses', 'customers', 'incomes', 'stock_movements', 'coupons', 'user_roles'
  ];
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY v_required
  LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      RAISE EXCEPTION 'stage2_missing_table:%', v_table
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
END $$;
