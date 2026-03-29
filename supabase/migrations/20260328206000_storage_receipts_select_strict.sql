-- OPCIONAL: aplicar SOLO cuando ya no queden comprobantes legacy en la raíz del bucket
-- (paths sin "/"). Antes corré:
--   node --env-file=.env.local scripts/migrate-receipts-legacy-to-user-prefix.mjs --execute
-- y verificá ventas/gastos con comprobantes.
--
-- Esta política elimina la rama `position('/' in name) = 0`: solo lectura bajo {auth.uid()}/...

DROP POLICY IF EXISTS "receipts_authenticated_select" ON storage.objects;

CREATE POLICY "receipts_authenticated_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND split_part(name, '/', 1) = auth.uid()::text
  );
