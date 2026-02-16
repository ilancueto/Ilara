-- RLS para tabla customers
-- Si RLS está activo pero no hay políticas, los INSERT/UPDATE/DELETE devuelven 403.
-- Ejecutar en Supabase: SQL Editor → New query → Pegar y Run

-- Asegurar que RLS está activo
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Política: usuarios autenticados pueden hacer todo (SELECT, INSERT, UPDATE, DELETE)
-- La app no usa user_id en customers; todos los usuarios logueados comparten la lista de clientes.
CREATE POLICY "Usuarios autenticados pueden gestionar clientes"
  ON customers
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Opcional: si querés que el catálogo o algo anónimo lea clientes, no lo habilitamos aquí.
-- Solo authenticated puede ver y modificar customers.
