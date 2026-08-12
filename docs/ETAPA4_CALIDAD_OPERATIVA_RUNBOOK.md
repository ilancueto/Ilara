# Etapa 4 — Calidad operativa (runbook maestro)

- **Estado (2026-08-12):** desplegado y verificado en producción.
- **Evidencia:** commit `775bc95`; CI GitHub verde (lint, unit, tipos, build,
  DB/integración, E2E y smoke local); deploy único Vercel **`ilara`** y smoke
  GET-only 16/16 sobre `https://ilara.com.ar`.

## Separación de estados

| Capa | Estado |
|---|---|
| Código Stage 4 en repo | Desplegado |
| Commit / push / CI remoto | Verificado verde |
| Deploy Vercel `ilara` | Ready, único destino |
| Smoke `https://ilara.com.ar` | 16/16 GET-only verde |
| Alertas / Sentry / RPO-RTO / PITR | **Pendiente decisión o config owner** |

## A. E2E + CI (TEST-01) — local

| Ítem | Estado honest |
|---|---|
| Workflow CI con lint/tsc/unit/build + db + e2e | En repo; **no verificado en GitHub Actions real** |
| E2E arranca servidor (`next start` en CI vía webServer; no se omite por CI=true) | Diseñado así |
| Mutaciones E2E solo con `E2E_*` (no fallback a `.env.local` / prod) | Sí |
| Bloqueo ref prod + hosts `*.supabase.co` remotos | Sí |
| Skip silencioso en CI | No: CI sin keys → fail |
| Smoke GET-only, `SMOKE_BASE_URL` obligatorio | Sí |

## B. Observabilidad

Ver `docs/ETAPA4_OBSERVABILIDAD_RUNBOOK.md`. Sin telemetría externa sin config.

## C. Accesibilidad — A11Y-01 (local)

| Hecho |
|---|
| `Dialog` + `ConfirmDialog` + `useConfirm` |
| `BulkActionDialog` + `BulkSelectList` para bulk: Inventario (delete/visibilidad/badge), Gastos, HistorialVentas, Clientes |
| `window.confirm` eliminado del código de app |
| E2E teclado + axe bulk: `e2e/bulk-a11y.spec.ts` (cancel/Escape + **confirm mutante** inventario/clientes) |
| Mutantes: seed identificable, assert UI + fila ausente en Supabase local, cleanup en `finally` |
| Loading: Escape/backdrop no cierran; botón confirm disabled con “Eliminando…” |

**Residual menor (no bulk destructivo):** formularios de edición (cliente, producto,
combo) y perfil de cliente siguen con portales legacy + `useDialogA11y` parcial —
fuera del alcance de confirmaciones destructivas bulk.

## D. Recuperación

Ver `docs/ETAPA4_OPERACION_RUNBOOK.md`. RPO/RTO = **propuestas**, no decisión.

## PWA / SW

El SW **no** borra todo CacheStorage: en `activate` elimina **solo** claves legacy
Ilara/Serwist/Workbox (ver `public/sw.js` y runbook Stage 3). Sin cache de negocio.

## Comandos de validación local

```bash
npm run lint
npx tsc --noEmit --incremental false
npm run test
npx supabase db reset --local
# E2E_* desde: npx supabase status -o env
npm run test:integration   # con STAGE0/1 flags + users
npm run test:db-rls && npm run test:db-security && npm run test:db-insecure-control
npm run db:types:check
npm run build
npx playwright install chromium
# export E2E_SUPABASE_URL / E2E_ANON_KEY / E2E_SERVICE_ROLE_KEY
npm run test:e2e
SMOKE_BASE_URL=http://127.0.0.1:3000 npm run test:smoke
git diff --check
```

## Prohibiciones

- Vercel `ilara-app`; passkeys; offline de negocio; migraciones Stage 0–3; E2E mutante prod.
