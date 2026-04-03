-- Impide stock negativo en cualquier vía (edición directa, API, scripts).
-- Las ventas vía create_sale_with_items ya validan antes de descontar; sin esto,
-- un UPDATE directo a products podía dejar stock < 0.

UPDATE public.products
SET stock = 0
WHERE stock < 0;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_stock_non_negative;

ALTER TABLE public.products
  ADD CONSTRAINT products_stock_non_negative CHECK (stock >= 0);

COMMENT ON CONSTRAINT products_stock_non_negative ON public.products IS
  'El inventario no puede ser negativo; corregir datos antes forzando ventas/ajustes coherentes.';
