# Runbook — Etapa 1 (roles y precios POS)

**Estado (2026-08-12):** migraciones aplicadas en Supabase producción después de
backup recuperable. Dos cuentas activas asignadas `admin`; cero `vendedor`.
Aplicación desplegada en Vercel producción; smoke público y autenticado correcto
con las dos cuentas reales. Etapa cerrada.
**Verificación de esta entrega:** migraciones aplicadas en Docker sobre un dump
`--schema public` de producción; matriz Etapa 0 + Etapa 1: **25/25**.

## Pre-requisitos

- Etapa 0 en producción **incluyendo** forward-fix
  `20260810215741_stage0_revoke_authenticated_legacy_inventory.sql`
  (**aplicado y verificado en producción** — REVOKE EXECUTE de
  `stage0_inventory_legacy_receipt_urls` a `authenticated`). La auditoría detectó
  un grant directo residual a `anon`; lo corrige
  `20260812002815_stage1_harden_legacy_anon_grants.sql`.
- Backup: `supabase db dump --linked --schema public -f backups/pre-stage1-YYYYMMDD.sql`
- UUID del primer admin confirmado. Los demás usuarios quedan `none`.
- No asignar `vendedor`: el rol queda inactivo hasta diseñar una superficie POS
  que no exponga `purchase_price`.
- Build local verde.

## Preflight SQL (privilegiado / postgres — no JWT de usuario)

```sql
SELECT tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'user_roles','sales','sale_items','products','stock_movements'
  )
ORDER BY tablename, policyname;

-- Esperado en user_roles tras 21411+21412:
-- user_roles_select_own, user_roles_select_admin

-- Esperado: NO sales_delete_admin / sale_items_delete_admin

-- Esperado: cero grants mutantes o administrativos para anon.
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee = 'anon'
  AND privilege_type IN (
    'INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES','MAINTAIN'
  );

-- Esperado: false en las tres columnas.
SELECT
  has_function_privilege(
    'anon', 'public.stage0_inventory_legacy_receipt_urls()', 'EXECUTE'
  ) AS anon_legacy_inventory,
  has_function_privilege(
    'anon', 'public.cleanup_expired_passkey_challenges()', 'EXECUTE'
  ) AS anon_passkey_cleanup,
  has_function_privilege(
    'authenticated', 'public.cleanup_expired_passkey_challenges()', 'EXECUTE'
  ) AS authenticated_passkey_cleanup;
```

## Orden de deploy

Los pasos 1–9 se completaron el 2026-08-12.

1. Backup esquema.
2. `20260810221411_stage1_app_roles`
3. `20260810221412_stage1_rls_by_role`
4. `20260810221413_stage1_pos_authoritative_pricing`
5. `20260812002815_stage1_harden_legacy_anon_grants`
6. Asignar las dos cuentas reales como admin; verificar `vendedor = 0`.
7. Deploy app Vercel.
8. Smoke.
9. Passkeys: **no activar**.

## Asignación de roles

### SQL Editor privilegiado (recomendado primer admin)

`auth.uid()` / JWT de usuario **no** equivalen a “admin” en el SQL Editor. Usar SQL directo:

```sql
INSERT INTO public.user_roles (user_id, role, updated_by)
VALUES ('UUID-ADMIN'::uuid, 'admin', 'UUID-ADMIN'::uuid)
ON CONFLICT (user_id) DO UPDATE
  SET role = 'admin', updated_at = now(), updated_by = EXCLUDED.updated_by;
```

### RPC con service_role (script local / Admin API — no browser)

```ts
await service.rpc('bootstrap_first_admin', { p_user_id: adminUuid })
// o
await service.rpc('set_user_role', { p_user_id: adminUuid, p_role: 'admin' })
```

- Lock compartido: `pg_advisory_xact_lock(87201411)` en bootstrap y `set_user_role`.
- Bootstrap **no** se llama desde el login de la app.

### Vendedor (deshabilitado por decisión de negocio)

```ts
// No ejecutar hasta aprobar una superficie POS limitada.
await supabase.rpc('set_user_role', { p_user_id: other, p_role: 'vendedor' })
```

## Grants y borrado de ventas (post-deploy)

| Operación | Camino |
|---|---|
| Crear venta | `create_sale_with_items` (DEFINER, `can_use_pos`) |
| Borrar venta | **solo** `delete_sale_and_restore_stock` (admin) |
| DELETE Data API sales/sale_items | denegado (sin grant/policy) |
| UPDATE sales (receipt/cobrar) | admin RLS |

La RPC de borrado toma `FOR UPDATE` sobre la venta antes de restaurar stock. El
smoke/integración debe comprobar que dos llamadas concurrentes producen un solo
borrado exitoso, un `sale_not_found` y una única restauración de inventario.

## Smoke

| Check | Esperado |
|---|---|
| none | sin panel; sales vacío o denegado |
| vendedor | RPC venta OK; no UPDATE products; no INSERT sales |
| admin | delete solo por RPC; set_user_role; lee todos user_roles |
| user_roles policies | own + admin presentes |
| unit_price manipulado | ignorado |
| breakdown objeto/string/JSON null | `invalid_payment_breakdown` |
| breakdown en método no-mixto | `payment_breakdown_not_allowed` |
| mixto sin array | `payment_breakdown_required` |
| passkey | **403** `PASSKEYS_DISABLED` (no 404) |
| catálogo anon | productos, categorías y combos visibles; sin purchase_price |
| grants anon | sin INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER/REFERENCES/MAINTAIN |
| vendedores | `SELECT count(*) FROM user_roles WHERE role='vendedor'` = 0 |

## Rollback

1. Detener tráfico de panel antes de revertir grants/RPC.
2. Restaurar funciones RPC desde el dump pre-Etapa 1.
3. Restaurar policies y grants capturados en el preflight.
4. Conservar `user_roles` durante la reversión; no borrar roles a ciegas.
5. Si la app ya fue desplegada, volver al deployment anterior de Vercel.
6. Confirmar catálogo anon, receipts privados y passkeys 403.

## Pruebas

```bash
npm run lint
npm exec tsc -- --noEmit --incremental false
npm run test
npm run test:integration   # sin STAGE1_INTEGRATION: solo gates
# Mutaciones: STAGE1_INTEGRATION=1 + staging/local (bloquea qbbnvdmadgomfmrsfxlo)
npm run test:e2e
npm run build
```

## Riesgos residuales

- Admin puede UPDATE `sales.total` vía Data API (metadatos abiertos a columna total). Mitigación futura: RPC de metadatos o privilegios de columna.
- `vendedor` conserva SELECT de tabla completa en `products`; por decisión de
  negocio no se asignará a ningún usuario. Antes de habilitarlo hay que separar
  la lectura POS de los campos internos.
- La cadena histórica completa no puede reconstruirse desde cero sólo con las
  migraciones versionadas: `incomes` y `stock_movements` existen en producción
  por drift anterior. Etapa 1 se validó contra un dump estructural de producción;
  conservar ese dump como artefacto de backup antes del despliegue.
- DATA-03 combos atómicos fuera de núcleo.
- Passkeys descartadas por decisión de negocio; la contención 403 permanece.
- Dos cuentas admin asignadas y verificadas; cero vendedores.
