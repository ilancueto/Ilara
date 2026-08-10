-- Etapa 0 / STO-01: receipts privado + políticas sin acceso anon.
-- PRERREQUISITO: migrar objetos legacy (path sin "/") y actualizar receipt_url
--   ver docs/STO01_LEGACY_RECEIPTS.md y npm run migrate:receipts[:execute]
-- NO aplicar en producción sin aprobación explícita y backup.
-- Tras aplicar: URL /object/public/receipts/... debe fallar (400/403/404).
--
-- Política SELECT: SOLO prefijo {auth.uid()}/ — sin rama legacy de objetos en la raíz.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'receipts') THEN
    UPDATE storage.buckets
    SET
      public = false,
      file_size_limit = 5242880,
      allowed_mime_types = ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf'
      ]::text[]
    WHERE id = 'receipts';
  ELSE
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'receipts',
      'receipts',
      false,
      5242880,
      ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
    );
  END IF;
END $$;

-- Forzar límites explícitos (sin COALESCE: siempre 5 MiB + allowlist).
UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]::text[]
WHERE id = 'receipts';

-- Eliminar políticas de storage.objects que den acceso a anon/public sobre receipts.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        'anon' = ANY (roles)
        OR 'public' = ANY (roles)
        OR policyname ILIKE '%public%receipt%'
        OR policyname ILIKE '%anon%receipt%'
        OR policyname = 'Users can view receipts'
        OR policyname = 'Authenticated can view receipts'
        OR policyname ILIKE 'receipts_%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Authenticated can view receipts" ON storage.objects;
DROP POLICY IF EXISTS "receipts_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "receipts_authenticated_select" ON storage.objects;
DROP POLICY IF EXISTS "receipts_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "receipts_authenticated_delete" ON storage.objects;

CREATE POLICY "receipts_authenticated_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND split_part(name, '/', 1) = (SELECT auth.uid()::text)
    AND split_part(name, '/', 2) <> ''
  );

-- SELECT estricto: únicamente objetos bajo el prefijo del usuario autenticado.
CREATE POLICY "receipts_authenticated_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND split_part(name, '/', 1) = (SELECT auth.uid()::text)
  );

CREATE POLICY "receipts_authenticated_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND split_part(name, '/', 1) = (SELECT auth.uid()::text)
  )
  WITH CHECK (
    bucket_id = 'receipts'
    AND split_part(name, '/', 1) = (SELECT auth.uid()::text)
  );

CREATE POLICY "receipts_authenticated_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND split_part(name, '/', 1) = (SELECT auth.uid()::text)
  );
