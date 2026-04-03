-- Permitir payment_method 'credito' y 'mixto' en sales
-- El constraint actual solo permite efectivo, tarjeta, transferencia.
-- Ejecutar en Supabase: SQL Editor → New query → Pegar y Run

ALTER TABLE sales
DROP CONSTRAINT IF EXISTS sales_payment_method_check;

ALTER TABLE sales
ADD CONSTRAINT sales_payment_method_check
CHECK (payment_method IS NULL OR payment_method IN (
  'efectivo',
  'tarjeta',
  'transferencia',
  'credito',
  'mixto'
));

COMMENT ON COLUMN sales.payment_method IS 'efectivo, tarjeta, transferencia, credito (cuenta por cobrar), mixto (varios métodos)';
