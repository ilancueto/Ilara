-- Etapa 1 / AUTH-01: RLS + grants mínimos por rol (admin / vendedor / none).
-- - Policies permisivas se combinan con OR: eliminar residuales abiertas.
-- - user_roles NO se barre con %_admin% sin recrear: se reafirma al final.
-- - Ventas/líneas: sin INSERT/DELETE directo authenticated; DELETE solo vía RPC.
-- - Admin UPDATE sales (receipt/cobrar). Mutación de líneas = RPC DEFINER.
-- - Catálogo anon y receipts no se reabren.

-- ═══════════════════════════════════════════════════════════════════════════
-- PREFLIGHT: residuales peligrosas (NO incluir user_roles en barrido %_admin%)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  r record;
  -- Tablas de panel EXCEPTO user_roles (policies de 21411 no deben borrarse aquí
  -- sin recreación; el barrido %_admin% mataba user_roles_select_admin).
  v_tables text[] := ARRAY[
    'products', 'categories', 'combos', 'combo_items',
    'sales', 'sale_items', 'customers', 'expenses', 'incomes',
    'stock_movements', 'coupons'
  ];
BEGIN
  -- 1) Policies abiertas USING(true) en tablas de panel (+ user_roles solo si true).
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        tablename = ANY (v_tables)
        OR tablename = 'user_roles'
      )
      AND (
        qual IS NULL
        OR qual = 'true'
        OR with_check = 'true'
        OR policyname ILIKE 'Authenticated%'
        OR policyname ILIKE 'Usuarios autenticados%'
        OR policyname ILIKE 'Users can%'
        OR policyname ILIKE 'Autenticados%'
      )
      -- Policies públicas mínimas de Etapa 0: conservarlas aunque una use
      -- USING (true). Sus grants de columna son la frontera de datos anon.
      AND NOT (
        (tablename = 'products' AND policyname = 'Anon catalog read products')
        OR (tablename = 'categories' AND policyname = 'Anon catalog read categories')
        OR (tablename = 'combos' AND policyname = 'Anon read active combos')
        OR (
          tablename = 'combo_items'
          AND policyname = 'Anon read combo_items for active combos'
        )
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;

  -- 2) Nombres stage1 previos en tablas de panel (sin user_roles).
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (v_tables)
      AND (
        policyname LIKE '%_staff%'
        OR policyname LIKE '%_admin%'
        OR policyname LIKE '%_write_%'
        OR policyname LIKE 'products_%'
        OR policyname LIKE 'sales_%'
        OR policyname LIKE 'sale_items_%'
        OR policyname LIKE 'categories_%'
        OR policyname LIKE 'combos_%'
        OR policyname LIKE 'combo_items_%'
        OR policyname LIKE 'customers_%'
        OR policyname LIKE 'expenses_%'
        OR policyname LIKE 'incomes_%'
        OR policyname LIKE 'stock_movements_%'
        OR policyname LIKE 'coupons_%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "sale_items_update_staff" ON public.sale_items;
DROP POLICY IF EXISTS "sales_insert_staff" ON public.sales;
DROP POLICY IF EXISTS "sales_update_staff" ON public.sales;
DROP POLICY IF EXISTS "sale_items_write_staff" ON public.sale_items;
DROP POLICY IF EXISTS "stock_movements_write_staff" ON public.stock_movements;
DROP POLICY IF EXISTS "sales_delete_admin" ON public.sales;
DROP POLICY IF EXISTS "sale_items_delete_admin" ON public.sale_items;

-- ═══════════════════════════════════════════════════════════════════════════
-- PRODUCTS
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select_staff" ON public.products;
DROP POLICY IF EXISTS "products_write_admin" ON public.products;
DROP POLICY IF EXISTS "products_insert_admin" ON public.products;
DROP POLICY IF EXISTS "products_update_admin" ON public.products;
DROP POLICY IF EXISTS "products_delete_admin" ON public.products;

CREATE POLICY "products_select_staff"
  ON public.products FOR SELECT TO authenticated
  USING (public.can_use_pos());

CREATE POLICY "products_insert_admin"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_inventory());

CREATE POLICY "products_update_admin"
  ON public.products FOR UPDATE TO authenticated
  USING (public.can_manage_inventory())
  WITH CHECK (public.can_manage_inventory());

CREATE POLICY "products_delete_admin"
  ON public.products FOR DELETE TO authenticated
  USING (public.can_manage_inventory());

REVOKE ALL ON TABLE public.products FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.products TO authenticated;
GRANT ALL ON TABLE public.products TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- CATEGORIES
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE IF EXISTS public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select_staff" ON public.categories;
DROP POLICY IF EXISTS "categories_write_admin" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_admin" ON public.categories;
DROP POLICY IF EXISTS "categories_update_admin" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_admin" ON public.categories;

CREATE POLICY "categories_select_staff"
  ON public.categories FOR SELECT TO authenticated
  USING (public.can_use_pos());

CREATE POLICY "categories_insert_admin"
  ON public.categories FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_inventory());

CREATE POLICY "categories_update_admin"
  ON public.categories FOR UPDATE TO authenticated
  USING (public.can_manage_inventory())
  WITH CHECK (public.can_manage_inventory());

CREATE POLICY "categories_delete_admin"
  ON public.categories FOR DELETE TO authenticated
  USING (public.can_manage_inventory());

REVOKE ALL ON TABLE public.categories FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.categories TO authenticated;
GRANT ALL ON TABLE public.categories TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- COMBOS / COMBO_ITEMS
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE IF EXISTS public.combos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "combos_select_staff" ON public.combos;
DROP POLICY IF EXISTS "combos_write_admin" ON public.combos;
DROP POLICY IF EXISTS "combos_insert_admin" ON public.combos;
DROP POLICY IF EXISTS "combos_update_admin" ON public.combos;
DROP POLICY IF EXISTS "combos_delete_admin" ON public.combos;

CREATE POLICY "combos_select_staff"
  ON public.combos FOR SELECT TO authenticated
  USING (public.can_use_pos());

CREATE POLICY "combos_insert_admin"
  ON public.combos FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_inventory());

CREATE POLICY "combos_update_admin"
  ON public.combos FOR UPDATE TO authenticated
  USING (public.can_manage_inventory())
  WITH CHECK (public.can_manage_inventory());

CREATE POLICY "combos_delete_admin"
  ON public.combos FOR DELETE TO authenticated
  USING (public.can_manage_inventory());

REVOKE ALL ON TABLE public.combos FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.combos TO authenticated;
GRANT ALL ON TABLE public.combos TO service_role;

ALTER TABLE IF EXISTS public.combo_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "combo_items_select_staff" ON public.combo_items;
DROP POLICY IF EXISTS "combo_items_write_admin" ON public.combo_items;
DROP POLICY IF EXISTS "combo_items_insert_admin" ON public.combo_items;
DROP POLICY IF EXISTS "combo_items_update_admin" ON public.combo_items;
DROP POLICY IF EXISTS "combo_items_delete_admin" ON public.combo_items;

CREATE POLICY "combo_items_select_staff"
  ON public.combo_items FOR SELECT TO authenticated
  USING (public.can_use_pos());

CREATE POLICY "combo_items_insert_admin"
  ON public.combo_items FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_inventory());

CREATE POLICY "combo_items_update_admin"
  ON public.combo_items FOR UPDATE TO authenticated
  USING (public.can_manage_inventory())
  WITH CHECK (public.can_manage_inventory());

CREATE POLICY "combo_items_delete_admin"
  ON public.combo_items FOR DELETE TO authenticated
  USING (public.can_manage_inventory());

REVOKE ALL ON TABLE public.combo_items FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.combo_items TO authenticated;
GRANT ALL ON TABLE public.combo_items TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- SALES / SALE_ITEMS
-- SELECT staff | UPDATE admin (metadatos) | sin INSERT/DELETE directo
-- DELETE de venta = solo public.delete_sale_and_restore_stock (DEFINER)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE IF EXISTS public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_select_staff" ON public.sales;
DROP POLICY IF EXISTS "sales_insert_staff" ON public.sales;
DROP POLICY IF EXISTS "sales_update_staff" ON public.sales;
DROP POLICY IF EXISTS "sales_update_admin" ON public.sales;
DROP POLICY IF EXISTS "sales_delete_admin" ON public.sales;

CREATE POLICY "sales_select_staff"
  ON public.sales FOR SELECT TO authenticated
  USING (public.can_use_pos());

CREATE POLICY "sales_update_admin"
  ON public.sales FOR UPDATE TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- Sin policy DELETE en sales: eliminación solo por RPC DEFINER.

DROP POLICY IF EXISTS "sale_items_select_staff" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_write_staff" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_update_staff" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_delete_admin" ON public.sale_items;

CREATE POLICY "sale_items_select_staff"
  ON public.sale_items FOR SELECT TO authenticated
  USING (public.can_use_pos());

-- Sin INSERT/UPDATE/DELETE de líneas vía Data API.

REVOKE ALL ON TABLE public.sales FROM PUBLIC;
REVOKE ALL ON TABLE public.sales FROM anon;
REVOKE ALL ON TABLE public.sales FROM authenticated;
GRANT SELECT, UPDATE ON TABLE public.sales TO authenticated;
GRANT ALL ON TABLE public.sales TO service_role;

REVOKE ALL ON TABLE public.sale_items FROM PUBLIC;
REVOKE ALL ON TABLE public.sale_items FROM anon;
REVOKE ALL ON TABLE public.sale_items FROM authenticated;
GRANT SELECT ON TABLE public.sale_items TO authenticated;
GRANT ALL ON TABLE public.sale_items TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- CUSTOMERS
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'customers'
  ) THEN
    EXECUTE 'ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "customers_staff_all" ON public.customers';
    EXECUTE 'DROP POLICY IF EXISTS "customers_select_staff" ON public.customers';
    EXECUTE 'DROP POLICY IF EXISTS "customers_write_staff" ON public.customers';
    EXECUTE 'DROP POLICY IF EXISTS "customers_insert_staff" ON public.customers';
    EXECUTE 'DROP POLICY IF EXISTS "customers_update_staff" ON public.customers';
    EXECUTE 'DROP POLICY IF EXISTS "customers_delete_staff" ON public.customers';
    EXECUTE $p$
      CREATE POLICY "customers_select_staff"
        ON public.customers FOR SELECT TO authenticated
        USING (public.can_use_pos())
    $p$;
    EXECUTE $p$
      CREATE POLICY "customers_insert_staff"
        ON public.customers FOR INSERT TO authenticated
        WITH CHECK (public.can_use_pos())
    $p$;
    EXECUTE $p$
      CREATE POLICY "customers_update_staff"
        ON public.customers FOR UPDATE TO authenticated
        USING (public.can_use_pos())
        WITH CHECK (public.can_use_pos())
    $p$;
    EXECUTE $p$
      CREATE POLICY "customers_delete_staff"
        ON public.customers FOR DELETE TO authenticated
        USING (public.can_use_pos())
    $p$;
    EXECUTE 'REVOKE ALL ON TABLE public.customers FROM PUBLIC';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customers TO authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.customers TO service_role';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- EXPENSES
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'expenses'
  ) THEN
    EXECUTE 'ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "expenses_staff_all" ON public.expenses';
    EXECUTE 'DROP POLICY IF EXISTS "expenses_select_staff" ON public.expenses';
    EXECUTE 'DROP POLICY IF EXISTS "expenses_insert_staff" ON public.expenses';
    EXECUTE 'DROP POLICY IF EXISTS "expenses_update_staff" ON public.expenses';
    EXECUTE 'DROP POLICY IF EXISTS "expenses_delete_staff" ON public.expenses';
    EXECUTE $p$
      CREATE POLICY "expenses_select_staff"
        ON public.expenses FOR SELECT TO authenticated
        USING (public.can_manage_finance())
    $p$;
    EXECUTE $p$
      CREATE POLICY "expenses_insert_staff"
        ON public.expenses FOR INSERT TO authenticated
        WITH CHECK (public.can_manage_finance())
    $p$;
    EXECUTE $p$
      CREATE POLICY "expenses_update_staff"
        ON public.expenses FOR UPDATE TO authenticated
        USING (public.can_manage_finance())
        WITH CHECK (public.can_manage_finance())
    $p$;
    EXECUTE $p$
      CREATE POLICY "expenses_delete_staff"
        ON public.expenses FOR DELETE TO authenticated
        USING (public.can_manage_finance())
    $p$;
    EXECUTE 'REVOKE ALL ON TABLE public.expenses FROM PUBLIC';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expenses TO authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.expenses TO service_role';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- INCOMES (solo admin)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'incomes'
  ) THEN
    EXECUTE 'ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "incomes_admin_all" ON public.incomes';
    EXECUTE 'DROP POLICY IF EXISTS "incomes_select_admin" ON public.incomes';
    EXECUTE 'DROP POLICY IF EXISTS "incomes_insert_admin" ON public.incomes';
    EXECUTE 'DROP POLICY IF EXISTS "incomes_update_admin" ON public.incomes';
    EXECUTE 'DROP POLICY IF EXISTS "incomes_delete_admin" ON public.incomes';
    EXECUTE $p$
      CREATE POLICY "incomes_select_admin"
        ON public.incomes FOR SELECT TO authenticated
        USING (public.is_app_admin())
    $p$;
    EXECUTE $p$
      CREATE POLICY "incomes_insert_admin"
        ON public.incomes FOR INSERT TO authenticated
        WITH CHECK (public.is_app_admin())
    $p$;
    EXECUTE $p$
      CREATE POLICY "incomes_update_admin"
        ON public.incomes FOR UPDATE TO authenticated
        USING (public.is_app_admin())
        WITH CHECK (public.is_app_admin())
    $p$;
    EXECUTE $p$
      CREATE POLICY "incomes_delete_admin"
        ON public.incomes FOR DELETE TO authenticated
        USING (public.is_app_admin())
    $p$;
    EXECUTE 'REVOKE ALL ON TABLE public.incomes FROM PUBLIC';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.incomes TO authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.incomes TO service_role';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STOCK_MOVEMENTS — lectura staff; escritura solo RPC DEFINER
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stock_movements'
  ) THEN
    EXECUTE 'ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "stock_movements_select_staff" ON public.stock_movements';
    EXECUTE 'DROP POLICY IF EXISTS "stock_movements_write_staff" ON public.stock_movements';
    EXECUTE $p$
      CREATE POLICY "stock_movements_select_staff"
        ON public.stock_movements FOR SELECT TO authenticated
        USING (public.can_use_pos())
    $p$;
    EXECUTE 'REVOKE ALL ON TABLE public.stock_movements FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON TABLE public.stock_movements FROM authenticated';
    EXECUTE 'GRANT SELECT ON TABLE public.stock_movements TO authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.stock_movements TO service_role';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- COUPONS (admin)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'coupons'
  ) THEN
    EXECUTE 'ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "coupons_admin_all" ON public.coupons';
    EXECUTE 'DROP POLICY IF EXISTS "coupons_select_admin" ON public.coupons';
    EXECUTE 'DROP POLICY IF EXISTS "coupons_insert_admin" ON public.coupons';
    EXECUTE 'DROP POLICY IF EXISTS "coupons_update_admin" ON public.coupons';
    EXECUTE 'DROP POLICY IF EXISTS "coupons_delete_admin" ON public.coupons';
    EXECUTE $p$
      CREATE POLICY "coupons_select_admin"
        ON public.coupons FOR SELECT TO authenticated
        USING (public.is_app_admin())
    $p$;
    EXECUTE $p$
      CREATE POLICY "coupons_insert_admin"
        ON public.coupons FOR INSERT TO authenticated
        WITH CHECK (public.is_app_admin())
    $p$;
    EXECUTE $p$
      CREATE POLICY "coupons_update_admin"
        ON public.coupons FOR UPDATE TO authenticated
        USING (public.is_app_admin())
        WITH CHECK (public.is_app_admin())
    $p$;
    EXECUTE $p$
      CREATE POLICY "coupons_delete_admin"
        ON public.coupons FOR DELETE TO authenticated
        USING (public.is_app_admin())
    $p$;
    EXECUTE 'REVOKE ALL ON TABLE public.coupons FROM PUBLIC';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.coupons TO authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.coupons TO service_role';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- REAFIRMAR user_roles (21411): propio + admin global — tras cualquier preflight
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_select_own_or_admin" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_admin" ON public.user_roles;

CREATE POLICY "user_roles_select_own"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "user_roles_select_admin"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (public.is_app_admin());

REVOKE ALL ON TABLE public.user_roles FROM PUBLIC;
REVOKE ALL ON TABLE public.user_roles FROM anon;
REVOKE ALL ON TABLE public.user_roles FROM authenticated;
GRANT SELECT ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;
