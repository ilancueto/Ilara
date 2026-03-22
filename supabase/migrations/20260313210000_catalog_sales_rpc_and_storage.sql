-- A3: Orden "Más vendidos" en catálogo sin dar SELECT en sale_items a anon.
-- La función corre con privilegios del owner (SECURITY DEFINER) y solo expone agregados.

CREATE OR REPLACE FUNCTION public.catalog_sales_by_product()
RETURNS TABLE (product_id bigint, units_sold bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT si.product_id::bigint, SUM(si.quantity)::bigint
  FROM public.sale_items si
  WHERE si.product_id IS NOT NULL
  GROUP BY si.product_id;
$$;

COMMENT ON FUNCTION public.catalog_sales_by_product() IS
  'Totales de unidades vendidas por product_id; ejecutable por anon para ordenar el catálogo público.';

REVOKE ALL ON FUNCTION public.catalog_sales_by_product() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalog_sales_by_product() TO anon;
GRANT EXECUTE ON FUNCTION public.catalog_sales_by_product() TO authenticated;

-- A4: Comprobantes en Storage — lectura por API solo para sesión autenticada (no anon).
-- Nota: si el bucket sigue marcado como "public" en Dashboard, las URLs públicas directas
--       pueden seguir sirviendo el archivo; para máxima privacidad: bucket privado + signed URLs en app.
DROP POLICY IF EXISTS "Users can view receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view receipts" ON storage.objects;
CREATE POLICY "Authenticated can view receipts"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipts');
