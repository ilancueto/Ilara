-- Agregar email y teléfono a clientes
-- Ejecutar en Supabase: SQL Editor → New query → Pegar y Run

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN customers.email IS 'Email del cliente (opcional)';
COMMENT ON COLUMN customers.phone IS 'Teléfono o WhatsApp del cliente (opcional)';
