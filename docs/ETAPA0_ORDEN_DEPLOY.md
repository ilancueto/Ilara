# Etapa 0 — Orden de despliegue (actualizado)

**No ejecutar sin aprobación.** Forward-fix: no reactivar passkeys ni reabrir
`anon` en ventas.

## Orden obligatorio

1. **Backup y preservación de logs**
   Ver `docs/ETAPA0_PRESERVACION.md`.

2. **Deploy Edge Function `passkey-auth` bloqueada**
   Contención SEC-01 en servidor (403 `PASSKEYS_DISABLED`) **antes** de tocar DB
   de catálogo/ventas. Corta el vector de toma de cuenta aunque la UI vieja siga
   en cache un rato.

3. **RPC agregado del catálogo**
   Aplicar `stage0_harden_catalog_sales_rpc`
   (`catalog_sales_by_product` con `search_path`, sin EXECUTE a PUBLIC residual).
   El orden “más vendidos” sigue funcionando sin SELECT en `sale_items`.

4. **Cierre anon en `sales` / `sale_items`**
   Aplicar `stage0_close_anon_sales`.
   Smoke negativo: anon no lee filas de ventas.

5. **Deploy de la app (Vercel)**
   Selects explícitos del DTO público, UI sin passkeys, JSON-LD escapado,
   comprobantes con signed URL / validación MIME.
   Validar catálogo y login por contraseña.

6. **Grants de catálogo (column-level)**
   Aplicar `stage0_public_catalog_column_grants`
   (REVOKE SELECT de **anon y PUBLIC** en products/categories/combos/combo_items,
   luego GRANT por columna a anon).
   Smoke: anon lee columnas públicas; falla al pedir `purchase_price` / `notes` /
   `min_stock`; catálogo visible.

7. **Pruebas anon / positivas / roles de prueba**
   Suite `npm run test:integration` contra staging o Supabase local
   (anon, usuario permitido, no permitido / cross-user, Storage, passkey 403).

8. **Receipts privado (solo tras migración legacy)**
   - Inventario: `stage0_receipts_legacy_path_inventory` + SQL de legacy
   - `npm run migrate:receipts` → `migrate:receipts:execute`
   - Confirmar 0 legacy
   - Aplicar `stage0_receipts_private_bucket` (5 MiB, MIME fijos, SELECT estricto)
   - Smoke: URL pública anónima falla; cross-user Storage denegado

## Por qué este orden

| Paso | Motivo |
|---|---|
| Edge Function primero | Cierra SEC-01 sin depender del build del catálogo |
| RPC antes de cerrar sales | Evita romper “más vendidos” si algo falla a mitad |
| Cerrar sales antes de grants de products | Prioriza datos de dinero/PII de ventas |
| App antes de column grants | `select('*')` fallaría con column privileges |
| Receipts al final | Requiere datos migrados; no bloquear contención de ventas |

## Forward-fix

Si un paso falla: **mantener** passkeys off y grants de ventas cerrados.
No reabrir anon ni reintroducir SELECT legacy de receipts.
