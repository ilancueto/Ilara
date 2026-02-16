-- Auditoría: quién creó / quién editó (6.4)
-- Ejecutar en Supabase: SQL Editor → New query → Pegar y Run
-- Agrega created_by y updated_by (uuid → auth.users) en tablas críticas.

-- SALES
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);
COMMENT ON COLUMN sales.created_by IS 'Usuario que registró la venta';
COMMENT ON COLUMN sales.updated_by IS 'Usuario que actualizó por última vez (ej. marcar como cobrada)';

-- EXPENSES (ya tiene user_id = dueño; agregamos updated_by)
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);
COMMENT ON COLUMN expenses.updated_by IS 'Usuario que editó por última vez';

-- PRODUCTS
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);
COMMENT ON COLUMN products.created_by IS 'Usuario que creó el producto';
COMMENT ON COLUMN products.updated_by IS 'Usuario que editó por última vez';

-- CUSTOMERS
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id);
COMMENT ON COLUMN customers.created_by IS 'Usuario que creó el cliente';
COMMENT ON COLUMN customers.updated_by IS 'Usuario que editó por última vez';
