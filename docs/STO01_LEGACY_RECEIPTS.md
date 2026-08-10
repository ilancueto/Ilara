# STO-01 — Migración de paths legacy de comprobantes

## Problema

Historicamente algunos objetos en el bucket `receipts` vivían en la **raíz**
(`archivo.jpg` sin carpeta). Una política de SELECT con:

```sql
position('/' in name) = 0
```

permitía que **cualquier usuario autenticado** leyera esos objetos si conocía el
nombre. Eso **no es solución final** y fue eliminado de
`stage0_receipts_private_bucket.sql`.

## Solución final

1. Cada objeto vive bajo `{auth.uid()}/nombre-no-predecible.ext`.
2. `sales.receipt_url` / `expenses.receipt_url` guardan ese path relativo.
3. Política SELECT: solo `split_part(name, '/', 1) = auth.uid()::text`.
4. Descargas vía **URL firmada** de corta duración (app).

## Procedimiento (staging → prod, con aprobación)

### A. Inventario (solo lectura)

```sql
SELECT * FROM public.stage0_inventory_legacy_receipt_urls()
WHERE is_legacy = true;
```

Requiere migración `stage0_receipts_legacy_path_inventory` aplicada.
**EXECUTE:** solo `service_role` (forward-fix `stage0_revoke_authenticated_legacy_inventory` — en repo; aplicar en prod cuando se autorice).

### B. Dry-run del script de movimiento

```bash
npm run migrate:receipts
```

Lista `path -> {ownerId}/path` sin escribir. Requiere
`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (nunca en cliente).

### C. Ejecución (aprobación explícita)

```bash
npm run migrate:receipts:execute
```

Por cada fila legacy con owner:

1. Descarga el objeto legacy
2. Sube a `{ownerId}/{filename}`
3. Actualiza `receipt_url` al path nuevo
4. Elimina el objeto legacy

Filas sin `created_by` / `user_id` se omiten (hay que asignar owner a mano).

### D. Verificar inventario vacío

```sql
SELECT count(*) FROM public.stage0_inventory_legacy_receipt_urls()
WHERE is_legacy = true;
-- esperado: 0
```

Listar Storage (service role) y confirmar que no quedan nombres en la raíz del
bucket.

### E. Aplicar bucket privado + SELECT estricto

Migración `stage0_receipts_private_bucket` (5 MiB, MIME fijos, sin rama legacy).

### F. Smoke

- Anon: URL pública directa → error
- Usuario A: signed URL de su path → OK
- Usuario B: no puede `createSignedUrl` / select del path de A

## Mecanismo transitorio (si el cierre estricto no puede aplicarse aún)

| Estado | Qué hacer | Qué NO hacer |
|---|---|---|
| Hay legacy pendiente | Completar B–D; **no** reintroducir `position('/' in name)=0` en migraciones nuevas | Dejar la política permisiva como “solución” |
| Owner desconocido | Asignar `created_by`/`user_id` o mover a un uid de sistema documentado | Exponer lectura global a authenticated |
| Ventana corta de ops | Operar con service role solo en script de migración; documentar hora de inicio/fin | Aplicar SELECT legacy en prod “por un tiempo” como diseño |

Si en un entorno **viejo** aún está aplicada la política con rama legacy
(`20260328203100`), el objetivo de contención es:

1. migrar objetos,
2. aplicar `stage0_receipts_private_bucket` (reemplaza políticas),
3. no volver a la rama legacy.

## Relación con el orden de deploy Etapa 0

Ver `docs/ETAPA0_ORDEN_DEPLOY.md`: **receipts privado va al final**, después de
migrar legacy.
