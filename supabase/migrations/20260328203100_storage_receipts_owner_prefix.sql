-- Comprobantes: nuevas subidas bajo {auth.uid()}/archivo.ext.
-- Lectura: propio prefijo O archivos legacy sin "/" (nombre sin slash = compatibilidad con paths viejos).
--   ⚠ Hasta migrar esos objetos al prefijo del usuario, cualquier authenticated puede leerlos si adivina el nombre.
--   Cierre: npm run migrate:receipts (simulación) → migrate:receipts:execute → migración opcional
--   20260328206000_storage_receipts_select_strict.sql (solo lectura bajo uid/).
-- Escritura/borrado: solo objetos bajo el prefijo del usuario autenticado.

DROP POLICY IF EXISTS "receipts_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "receipts_authenticated_select" ON storage.objects;
DROP POLICY IF EXISTS "receipts_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "receipts_authenticated_delete" ON storage.objects;

CREATE POLICY "receipts_authenticated_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND split_part(name, '/', 1) = auth.uid()::text
    AND split_part(name, '/', 2) <> ''
  );

CREATE POLICY "receipts_authenticated_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (
      split_part(name, '/', 1) = auth.uid()::text
      OR position('/' in name) = 0
    )
  );

CREATE POLICY "receipts_authenticated_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'receipts'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "receipts_authenticated_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND split_part(name, '/', 1) = auth.uid()::text
  );
