# Runbook — Etapa 2 (Gobierno y reproducibilidad de datos)

**Estado (2026-08-12): COMPLETADO, DESPLEGADO Y VERIFICADO.** Stage 0 y Stage 1
permanecen cerrados.

## Objetivo

Poder reconstruir el esquema de aplicación desde cero con la CLI de Supabase,
tiparlo, verificarlo en CI y documentar el drift residual con producción.

## Estrategia elegida

| Pieza | Decisión |
|---|---|
| Baseline greenfield | `20250101000000_baseline_core_schema.sql` **completo** (antes incompleto / sin trackear) |
| Historial remoto | **No se reescribe**. Producción ya tiene `20250101000000` aplicada; el contenido nuevo **no** se re-ejecuta allí |
| Forward-only | `20260812013913_stage2_schema_governance_markers.sql` (índices FK, passkeys contenidas, contrato de tablas, trigger `updated_at`) |
| Scripts `supabase/sql/` | Históricos / evidencia; ver `supabase/sql/README.md` |
| Tipos | `types/database.generated.ts` regenerados desde local |
| CI | job `db-security` con `supabase start`, advisors, matriz, control negativo |

### Por qué no squash del historial

Reescribir migraciones ya aplicadas en `qbbnvdmadgomfmrsfxlo` rompería
`schema_migrations` y forzaría repair manual riesgoso. El baseline expandido solo
gobierna **instalaciones nuevas** y `db reset` local.

### Cómo se evita doble creación

- Baseline y Stage 2 usan `IF NOT EXISTS` / `DROP … IF EXISTS`.
- En producción, Stage 2 es aditiva e idempotente.
- Objetos Stage 0/1 no se reabren.

### Equivalencia con producción

1. `supabase db reset --local`
2. `supabase db dump --local --schema public -f local.sql` (sin datos)
3. `supabase db dump --linked --schema public -f prod.sql` (solo lectura)
4. Diff estructural sanitizado (sin UUIDs de usuarios ni filas)
5. `supabase db diff --from local --to linked --schema public`

Diferencias residuales esperadas (documentadas): `serial`/`integer` local vs
`bigint`+sequences en prod; `DEFAULT PRIVILEGES` históricos en prod; datos y
estadísticas. Esto es compatibilidad funcional, no paridad estructural completa.
No se fuerza un cast masivo a bigint en Stage 2 porque también exigiría versionar
las firmas y casts `integer` de RPC históricas, además de un cambio productivo de FKs.

## Reconstrucción local limpia

```bash
# Docker Desktop en ejecución
npx supabase start          # stack completo: DB, Auth, REST y Storage
npx supabase db reset --local
npx supabase migration list --local
npm run db:types
npm run db:advisors:security
npm run test:db-rls
# exportar keys sin copiarlas a tickets:
#   eval "$(npx supabase status -o env)"  # bash
npm run test:db-security
npm run test:db-insecure-control
```

Variables para matriz / integración (locales):

| Variable | Uso |
|---|---|
| `STAGE2_SUPABASE_URL` / `API_URL` | URL local |
| `STAGE2_ANON_KEY` / `ANON_KEY` | anon |
| `STAGE2_SERVICE_ROLE_KEY` | service_role (solo local) |
| `STAGE0_INTEGRATION=1` + `STAGE1_INTEGRATION=1` | suites vitest |

**Prohibido** apuntar la matriz mutante o el control negativo al project ref
productivo.

## Generación de tipos

```bash
npm run db:types          # escribe types/database.generated.ts
npm run db:types:check    # falla si hay drift vs local
```

Tipos manuales de dominio (`lib/supabase.ts`, `lib/types.ts`) se conservan como
capa de UI; el tipo canónico del esquema es `Database` en
`types/database.generated.ts`. Refactor masivo de casts `as unknown` queda fuera
de Stage 2 (solo inventario).

## Advisors (clasificación Stage 2)

| Hallazgo | Nivel | Clasificación |
|---|---|---|
| `rls_enabled_no_policy` en tablas passkey | INFO | **Intencional/documentado** — passkeys deshabilitadas; RLS on + sin grants |
| `unindexed_foreign_keys` (varios) | INFO | **Corregido en Stage 2** (0 residuales post-reset) |
| `multiple_permissive_policies` en `user_roles` | WARN (performance) | **Intencional/documentado** — `select_own` + `select_admin` Stage 1 |
| Security WARN/ERROR | — | **Ninguno** en local post-reset |
| Índices “unused” | — | **No eliminar** en entorno fresco |
| RPC `SECURITY DEFINER` ejecutables | WARN hosted | **Previo/intencional Stage 0/1**: catálogo público y RPC autenticadas con autorización interna |
| Leaked password protection | WARN hosted | **Deuda Auth separada**; no introducida por Stage 2 |

## Deploy productivo ejecutado (2026-08-12)

### Supabase

1. Backup estructural: `backups/pre-stage2-20260812.sql` (local, ignorado por Git).
2. Dry-run confirmó una sola migración pendiente.
3. Aplicada `20260812013913_stage2_schema_governance_markers` con `db push`.
4. `migration list` remoto = local.
5. Advisors consultados y clasificados.
6. Smoke: sitio/catálogo/RPC 200; sales y `purchase_price` anon 401; passkeys 403.
7. CI GitHub verde y único deployment Vercel `ilara` READY.

### Vercel (si hubiera push de app)

**Único proyecto autorizado:** `ilara` / `prj_l1212uETlGghvn8jChfiXCp68SzN` →
https://ilara.com.ar. Ver [`docs/VERCEL_PROYECTO_AUTORIZADO.md`](./VERCEL_PROYECTO_AUTORIZADO.md).

- `ilara-app` es solo Supabase + npm package, **nunca** un proyecto Vercel.
- Preflight: leer `.vercel/project.json` y exigir `projectName=ilara` y el Project ID exacto.
- Prohibido `vercel link` / crear proyectos / importar como `ilara-app`.
- Post-push: un solo deployment `Production – ilara`; no debe aparecer `Production – ilara-app`.

## Rollback / forward-fix

- **Rollback de índices:** `DROP INDEX IF EXISTS …` de los índices Stage 2 (no urgente).
- **Policies passkey:** no reabrir; si hace falta, forward-fix con `DROP POLICY`.
- **Baseline:** no se revierte en prod (no se re-ejecuta).
- **App:** sin cambio de contrato de API requerido.

## Gate de salida Stage 2

| Criterio | Evidencia |
|---|---|
| `db reset` reconstruye | Local verificado; repetir tras cada cambio de migración |
| Sin schema solo-dashboard nuevo | Migraciones versionadas |
| Tipos generados | `types/database.generated.ts` + check |
| CI detecta policy anónima permisiva | `test:db-insecure-control` |
| Stage 0/1 intactos | Sin editar migraciones aplicadas |
| Migración productiva | `20260812013913` en historial remoto |
| Smoke productivo | Catálogo 200; superficie interna 401; passkeys 403 |

Stage 2 quedó marcado **Completado** después del deploy y smoke autorizados.
