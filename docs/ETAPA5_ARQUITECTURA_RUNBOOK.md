# Etapa 5 — Arquitectura incremental (runbook)

- **Estado:** **cerrado, desplegado y verificado** en producción.
- **HEAD de entrega:** `a8f4a8e`.
- **Sin SQL remoto, migraciones, cambios de RLS/grants ni Edge Functions remotas.**
- **Evidencia de cierre:** CI remoto verde, deploy Vercel `ilara` READY y smoke
  productivo read-only 16/16 OK.

## Separación de estados

| Capa | Estado |
|---|---|
| Código Stage 5 | **Completado** (`a8f4a8e`) |
| Commit / push / CI remoto | **Completado** — `main`, CI verde |
| Deploy Vercel `ilara` | **Completado** — producción READY |
| Smoke `https://ilara.com.ar` | **Completado** — 16/16 checks OK, solo lectura |

## A. Clientes Supabase

| Cliente | Módulo | Bundle | Uso |
|---|---|---|---|
| Browser autenticado | `lib/supabase/browser.ts` | Cliente | Panel, POS, gastos, refetch catálogo |
| Público (anon, sin cookies) | `lib/supabase/public.ts` | **server-only** | RSC catálogo, sitemap, ISR |
| Server + cookies | `lib/supabase/server.ts` | **server-only** | Server Actions, RSC con sesión |
| Service role | **No en app** | — | Solo scripts/E2E locales y Edge Functions legacy |

Barril de compatibilidad: `lib/supabase.ts` reexporta **solo** browser + tipos de panel +
`getProductImages`. No reexporta server/public.

**Regla:** nunca importar `server`/`public`/`dal/*` desde componentes `'use client'`.

## B. DAL y dominios

```
lib/dal/           # server-only, auth + catálogo server
  auth.ts          # getSessionUser, requireAdmin (RPC current_app_role)
  catalog.ts       # reexport lecturas públicas servidor

lib/domain/
  types.ts         # modelos de panel (incluye purchase_price)
  errors.ts        # AppError + mapRpcMessageToAppError
  images.ts
  catalog/
    publicDto.ts   # PublicCatalogProduct/Combo sin campos internos
    publicQueries.ts
  sales/
    createSale.ts  # payload + parse + errores (puro)
    browserSales.ts # createSaleWithItems (browser + RLS/RPC)
  customers/
    browserCustomers.ts
  expenses/columns.ts
  inventory/adminSelect.ts

lib/catalog/
  publicCatalogSelect.ts  # columnas Stage 0
  serverCatalog.ts        # server-only + DTO público
```

### Fronteras elegidas (conservadoras)

1. **Catálogo público:** server DAL + DTO `PublicCatalog*` + select Stage 0. No
   `purchase_price` / notes / min_stock / auditoría.
2. **Panel admin / POS:** client-side deliberado con **RLS + RPC autoritativos**
   (`create_sale_with_items`, `delete_sale_and_restore_stock`). No se reescribió a
   Server Actions para no cambiar UX ni modelo de sesión.
3. **Autorización:** real en Supabase. UI usa `current_app_role` (browser) y
   `requireAdmin` (server) solo como capa de orquestación.
4. **Service role:** prohibido en app. Tests Stage 5 lo verifican.

## C. Cómo agregar un dominio nuevo

1. Definir DTO de lectura/comando en `lib/domain/<dominio>/` (sin `select *` con
   columnas sensibles en superficies públicas).
2. Si es **solo servidor** (secrets, cookies privilegiadas): poner en `lib/dal/`
   con `import 'server-only'` y usar `createSupabaseServerClient` o
   `createSupabasePublicClient`.
3. Si es **panel autenticado** (RLS): módulo browser en `lib/domain/...` con
   `getBrowserSupabase()`.
4. No duplicar reglas de stock/precios que ya viven en RPC.
5. Añadir pruebas unitarias de mappers/payloads puros.
6. No tocar migraciones ni RLS salvo defecto crítico (documentar, no implementar).

## D. Errores y observabilidad

- `lib/domain/errors.ts`: `AppError` con `code` + `userMessage`.
- Logs: Stage 4 (`lib/observability/*`) con sanitización; sin PII/payloads de venta.
- UI: mensajes accionables; no reintroducir `window.confirm`.

## E. Comandos de validación local

```bash
npm run lint
npx tsc --noEmit --incremental false
npm run test
npm run build
npm run check:pwa-icons
npx supabase db reset --local   # sólo local
# Stage 0/1 integration con vars locales
npm run test:db-rls
npm run test:db-security
npm run test:db-insecure-control
npm run db:types:check
# E2E_* = loopback only
npm run test:e2e
SMOKE_BASE_URL=http://127.0.0.1:3000 npm run test:smoke
git diff --check
git diff --name-only -- supabase/migrations/   # debe quedar vacío
```

## F. Prohibiciones

- Vercel `ilara-app`; passkeys de producto; offline de negocio; migraciones Stages 0–3;
  E2E mutante contra producción; service role en bundle cliente.
- No commitear `.env.local`, keys, ni archivos excluidos del usuario
  (`.cursor/`, `AGENTS.md`, `CLAUDE.md`, `capturas/`, `mockups/`).

## G. Residual (Stage 6 / deuda)

- Componentes grandes (Inventario, Tablero, Catalogo, Clientes) aún mezclan UI y
  fetch; se extrajo lógica crítica de ventas/catálogo, no se reescribió la UI.
- Formularios de edición/perfil legacy (a11y parcial) fuera de bulk.
- RPO/RTO, alertas externas, Sentry con DSN: decisión owner.
