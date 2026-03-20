-- RLS en todas las tablas del proyecto Ilara (6.1)
-- Ejecutar en Supabase: SQL Editor → New query → Pegar y Run
-- Si ya corriste supabase_customers_rls.sql o supabase_stock_movements.sql, no hay conflicto:
--   customers y stock_movements se re-definen aquí para tener un solo script idempotente.

-- ========== CUSTOMERS ==========
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuarios autenticados pueden gestionar clientes" ON customers;
CREATE POLICY "Usuarios autenticados pueden gestionar clientes"
  ON customers FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ========== PRODUCTS ==========
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can manage products" ON products;
CREATE POLICY "Authenticated can manage products"
  ON products FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ========== CATEGORIES ==========
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can manage categories" ON categories;
CREATE POLICY "Authenticated can manage categories"
  ON categories FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ========== SALES ==========
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can manage sales" ON sales;
CREATE POLICY "Authenticated can manage sales"
  ON sales FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ========== SALE_ITEMS ==========
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can manage sale_items" ON sale_items;
CREATE POLICY "Authenticated can manage sale_items"
  ON sale_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ========== EXPENSES (compartidos entre usuarios autenticados, user_id se guarda para auditoría) ==========
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own expenses" ON expenses;
DROP POLICY IF EXISTS "Authenticated can manage expenses" ON expenses;
CREATE POLICY "Authenticated can manage expenses"
  ON expenses FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ========== STOCK_MOVEMENTS ==========
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can manage stock_movements" ON stock_movements;
CREATE POLICY "Authenticated can manage stock_movements"
  ON stock_movements FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ========== COUPONS ==========
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can manage coupons" ON coupons;
CREATE POLICY "Authenticated can manage coupons"
  ON coupons FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ========== COMBOS (catálogo público + panel autenticado) ==========
-- Requiere que existan las tablas combos / combo_items (ver supabase_combos.sql).
ALTER TABLE combos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon read active combos" ON combos;
DROP POLICY IF EXISTS "Authenticated manage combos" ON combos;
CREATE POLICY "Anon read active combos"
  ON combos FOR SELECT TO anon
  USING (is_active = true);
CREATE POLICY "Authenticated manage combos"
  ON combos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ========== COMBO_ITEMS ==========
ALTER TABLE combo_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anon read combo_items for active combos" ON combo_items;
DROP POLICY IF EXISTS "Authenticated manage combo_items" ON combo_items;
CREATE POLICY "Anon read combo_items for active combos"
  ON combo_items FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM combos c
      WHERE c.id = combo_items.combo_id AND c.is_active = true
    )
  );
CREATE POLICY "Authenticated manage combo_items"
  ON combo_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ========== PRODUCTS: lectura anónima alineada con el catálogo público ==========
-- Misma intención que .or('visible_in_catalog.eq.true,visible_in_catalog.is.null') y stock >= 0 en Catalogo.tsx
DROP POLICY IF EXISTS "Anon catalog read products" ON products;
CREATE POLICY "Anon catalog read products"
  ON products FOR SELECT TO anon
  USING (
    (visible_in_catalog IS NULL OR visible_in_catalog = true)
    AND stock >= 0
  );

-- ========== CATEGORIES: chips del catálogo sin login ==========
DROP POLICY IF EXISTS "Anon catalog read categories" ON categories;
CREATE POLICY "Anon catalog read categories"
  ON categories FOR SELECT TO anon
  USING (true);
