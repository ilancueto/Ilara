# STO-01 — Verificar bucket `receipts` privado

Aplicar la migración `*_stage0_receipts_private_bucket.sql` **solo con aprobación** y backup,
y **solo después** de migrar paths legacy (ver `docs/STO01_LEGACY_RECEIPTS.md`).
La política SELECT es estricta (sin `position('/' in name) = 0`).

## Tras aplicar en el entorno objetivo

1. Dashboard Supabase → Storage → bucket `receipts` → **Public** debe estar **off**.
2. Con una sesión **anon** (solo `anon` key, sin login):
   - `GET` a una URL del estilo
     `https://<ref>.supabase.co/storage/v1/object/public/receipts/<path>`
     debe fallar (400/403/404), **no** devolver el archivo.
3. Con usuario **authenticated** del panel:
   - Subir un comprobante de prueba desde Gastos/Ventas.
   - La app debe guardar un **path** (`uid/...`), no una URL pública permanente.
   - La vista previa debe usar **signed URL** de corta duración (`createSignedUrl`).
4. No copiar URLs firmadas ni paths con datos reales a tickets.

## App (ya implementado en repo)

- Validación MIME: jpeg/png/webp/pdf
- Tamaño máx. 5 MiB
- Prefijo `{auth.uid()}/` + nombre no predecible
- TTL firmado por defecto 300 s
