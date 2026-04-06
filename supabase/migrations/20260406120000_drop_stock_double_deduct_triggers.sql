-- Elimina triggers que causan doble descuento de stock al vender.
--
-- El RPC create_sale_with_items ya hace:
--   1. UPDATE products SET stock = stock - qty   ← descuento real
--   2. INSERT INTO stock_movements (qty = -n)     ← sólo auditoría/historial
--
-- Si existe un trigger AFTER INSERT en stock_movements (o en sale_items) que
-- también descuente stock en products, cada venta resta el stock dos veces.
-- Esta migración los elimina de forma idempotente.

-- ─── Triggers sobre stock_movements ──────────────────────────────────────────
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table  = 'stock_movements'
      AND trigger_schema      = 'public'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON public.stock_movements',
      r.trigger_name
    );
    RAISE NOTICE 'Trigger eliminado de stock_movements: %', r.trigger_name;
  END LOOP;
END $$;

-- ─── Triggers sobre sale_items ────────────────────────────────────────────────
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table  = 'sale_items'
      AND trigger_schema      = 'public'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON public.sale_items',
      r.trigger_name
    );
    RAISE NOTICE 'Trigger eliminado de sale_items: %', r.trigger_name;
  END LOOP;
END $$;

-- ─── Triggers sobre products (por precaución) ─────────────────────────────────
-- Solo elimina triggers que apliquen automáticamente una segunda resta de stock.
-- Si existen triggers de validación (ej. check) no los tocamos; en la práctica
-- este bloque emite NOTICE para visibilidad sin romper nada útil.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT trigger_name, action_statement
    FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table  = 'products'
      AND trigger_schema      = 'public'
      AND event_manipulation  IN ('INSERT', 'UPDATE')
  LOOP
    RAISE NOTICE 'Trigger en products detectado (revisar manualmente si descuenta stock): %  →  %',
      r.trigger_name, left(r.action_statement, 120);
  END LOOP;
END $$;

COMMENT ON TABLE public.stock_movements IS
  'Historial de movimientos de stock (auditoría). El descuento real de products.stock
   lo hace exclusivamente la función create_sale_with_items via UPDATE directo;
   los registros en esta tabla NO deben provocar ningún trigger adicional sobre products.';
