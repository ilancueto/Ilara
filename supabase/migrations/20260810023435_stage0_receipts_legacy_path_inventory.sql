-- Etapa 0 / STO-01: inventario de paths legacy (sin "/") para migración de comprobantes.
-- NO mueve archivos ni cambia políticas. Ejecutar en staging/prod con service role o SQL editor.
-- Procedimiento completo: docs/STO01_LEGACY_RECEIPTS.md
--
-- Tras vaciar el inventario (0 filas legacy en sales/expenses y 0 objetos sin prefijo),
-- aplicar 20260810021815_stage0_receipts_private_bucket.sql (SELECT estricto).

CREATE OR REPLACE FUNCTION public.stage0_inventory_legacy_receipt_urls()
RETURNS TABLE (
  source_table text,
  row_id text,
  stored_url text,
  bucket_path text,
  owner_id uuid,
  is_legacy boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH sales_rows AS (
    SELECT
      'sales'::text AS source_table,
      s.id::text AS row_id,
      s.receipt_url::text AS stored_url,
      CASE
        WHEN s.receipt_url IS NULL OR btrim(s.receipt_url) = '' THEN NULL
        WHEN s.receipt_url LIKE '%/object/public/receipts/%' THEN
          split_part(split_part(s.receipt_url, '/object/public/receipts/', 2), '?', 1)
        WHEN s.receipt_url LIKE '%/object/sign/receipts/%' THEN
          split_part(split_part(s.receipt_url, '/object/sign/receipts/', 2), '?', 1)
        WHEN s.receipt_url ~ '^https?://' THEN
          NULLIF(split_part(regexp_replace(s.receipt_url, '^.*receipts/', ''), '?', 1), '')
        ELSE split_part(s.receipt_url, '?', 1)
      END AS bucket_path,
      s.created_by AS owner_id
    FROM public.sales s
    WHERE s.receipt_url IS NOT NULL AND btrim(s.receipt_url) <> ''
  ),
  expense_rows AS (
    SELECT
      'expenses'::text AS source_table,
      e.id::text AS row_id,
      e.receipt_url::text AS stored_url,
      CASE
        WHEN e.receipt_url IS NULL OR btrim(e.receipt_url) = '' THEN NULL
        WHEN e.receipt_url LIKE '%/object/public/receipts/%' THEN
          split_part(split_part(e.receipt_url, '/object/public/receipts/', 2), '?', 1)
        WHEN e.receipt_url LIKE '%/object/sign/receipts/%' THEN
          split_part(split_part(e.receipt_url, '/object/sign/receipts/', 2), '?', 1)
        WHEN e.receipt_url ~ '^https?://' THEN
          NULLIF(split_part(regexp_replace(e.receipt_url, '^.*receipts/', ''), '?', 1), '')
        ELSE split_part(e.receipt_url, '?', 1)
      END AS bucket_path,
      e.user_id AS owner_id
    FROM public.expenses e
    WHERE e.receipt_url IS NOT NULL AND btrim(e.receipt_url) <> ''
  )
  SELECT
    source_table,
    row_id,
    stored_url,
    bucket_path,
    owner_id,
    (bucket_path IS NOT NULL AND position('/' in bucket_path) = 0) AS is_legacy
  FROM sales_rows
  UNION ALL
  SELECT
    source_table,
    row_id,
    stored_url,
    bucket_path,
    owner_id,
    (bucket_path IS NOT NULL AND position('/' in bucket_path) = 0) AS is_legacy
  FROM expense_rows;
$$;

COMMENT ON FUNCTION public.stage0_inventory_legacy_receipt_urls() IS
  'Inventario de receipt_url; is_legacy=true si el path en bucket no tiene prefijo de usuario.';

REVOKE ALL ON FUNCTION public.stage0_inventory_legacy_receipt_urls() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stage0_inventory_legacy_receipt_urls() TO service_role;
-- authenticated puede inventariar en staging controlado; no abre Storage.
GRANT EXECUTE ON FUNCTION public.stage0_inventory_legacy_receipt_urls() TO authenticated;
