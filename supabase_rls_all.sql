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

-- ========== EASTER_CLAIMS (opcional; usado por API) ==========
-- Si la tabla existe y querés que solo backend/authenticated la use:
-- ALTER TABLE easter_claims ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Authenticated or service role" ON easter_claims FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Por ahora no la incluimos; la ruta API puede usar service role key si hace falta.
