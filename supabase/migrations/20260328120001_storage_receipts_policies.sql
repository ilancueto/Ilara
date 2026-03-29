-- Políticas para bucket `receipts` cuando está en modo **private**.
-- 1) Dashboard → Storage → receipts → desactivar "Public bucket".
-- 2) Aplicar esta migración (o ejecutar el SQL en el editor).
--
-- La app usa createSignedUrl en el cliente; hace falta SELECT para usuarios autenticados.

DO $$
BEGIN
  -- Bucket debe existir (creado desde Dashboard o API)
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'receipts') THEN
    RAISE NOTICE 'Bucket storage.receipts no existe: crealo en Dashboard antes de usar comprobantes.';
    RETURN;
  END IF;
END $$;

DROP POLICY IF EXISTS "receipts_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "receipts_authenticated_select" ON storage.objects;
DROP POLICY IF EXISTS "receipts_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "receipts_authenticated_delete" ON storage.objects;

CREATE POLICY "receipts_authenticated_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "receipts_authenticated_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipts');

CREATE POLICY "receipts_authenticated_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'receipts')
  WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "receipts_authenticated_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'receipts');
