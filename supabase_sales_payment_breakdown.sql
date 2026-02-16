-- Múltiples métodos de pago por venta (2.4)
-- Ejecutar en Supabase: SQL Editor → New query → Pegar y Run

-- Columna opcional: array de { "method": "efectivo", "amount": 5000 }
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS payment_breakdown jsonb DEFAULT NULL;

COMMENT ON COLUMN sales.payment_breakdown IS 'Desglose de pagos cuando hay más de un método: [{ "method": "efectivo", "amount": 5000 }, ...]';
