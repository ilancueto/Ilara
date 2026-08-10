-- Etapa 0 / SEC-02: reafirmar RPC de agregados del catálogo.
-- SECURITY DEFINER con search_path fijo; sin EXECUTE para PUBLIC; retorno mínimo.

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
  'Agregado product_id + units_sold para orden del catálogo. Sin PII ni filas de venta.';

REVOKE ALL ON FUNCTION public.catalog_sales_by_product() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalog_sales_by_product() TO anon;
GRANT EXECUTE ON FUNCTION public.catalog_sales_by_product() TO authenticated;
