-- Forward-fix Etapa 0: inventario legacy de comprobantes.
-- La función stage0_inventory_legacy_receipt_urls() expone paths de receipt_url
-- (comprobantes) y es exclusiva de operaciones privilegiadas (service_role).
-- No reabrir a anon. No modificar el cuerpo de la función.

REVOKE ALL ON FUNCTION public.stage0_inventory_legacy_receipt_urls() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.stage0_inventory_legacy_receipt_urls() FROM authenticated;

GRANT EXECUTE ON FUNCTION public.stage0_inventory_legacy_receipt_urls() TO service_role;

COMMENT ON FUNCTION public.stage0_inventory_legacy_receipt_urls() IS
  'Inventario de paths de comprobantes (receipt_url). Contiene rutas de Storage; EXECUTE solo service_role. Operaciones privilegiadas de contención STO-01.';
