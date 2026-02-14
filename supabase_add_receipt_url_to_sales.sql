-- Ejecutá este script en Supabase: SQL Editor → New query → Pegar y Run
-- Agrega la columna receipt_url a la tabla sales para poder adjuntar comprobantes al editar ventas.

ALTER TABLE sales ADD COLUMN IF NOT EXISTS receipt_url TEXT;
