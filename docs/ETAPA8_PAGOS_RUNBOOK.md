# Etapa 8 — Runbook vivo

Fuente de arquitectura: [`ETAPA8_PAYMENT_ADR.md`](./ETAPA8_PAYMENT_ADR.md).
Resumen de producto: [`ETAPA8_PAGOS_ONLINE.md`](./ETAPA8_PAGOS_ONLINE.md).

Actualizar este archivo al cerrar cada subetapa con evidencia (comando,
commit, deploy). No marcar un ítem si solo compiló.

## Guardrails permanentes

- Rama: `main`. HEAD de partida: `28dd208`.
- No tocar `.cursor/`, `AGENTS.md`, `CLAUDE.md`, `mockups/ilara-suite-overhaul/`.
- No `git reset --hard`. No borrar migraciones. No inventar credenciales.
- No cobros ni reembolsos reales sin aviso previo al propietario.
- Feature flags apagados hasta 8.6.

## 8.0 Auditoría y ADR

- [x] `git status` limpio salvo archivos del propietario
- [x] HEAD = `28dd208`
- [x] Leídos PLAN, runbooks 6.1 / 6.3 / 6.4 / 6.6 / 7 y `ETAPA8_PAGOS_ONLINE.md`
- [x] Inspeccionadas migraciones 6.1–7.2
- [x] Identificados RPC, stock, snapshots, cupones, shipping, 6.3/6.4/6.6, bucket `receipts`, panel y checkout
- [x] Next.js 16 docs (Server Actions, Route Handlers)
- [x] Docs oficiales Mercado Pago (Checkout Pro, preferencias, webhooks, back_urls, refunds)
- [x] Docs oficiales Supabase Cron (`cron.schedule`, no editar `cron.job`)
- [x] ADR escrito
- [x] `ETAPA8_PAGOS_ONLINE.md` sin señas y con decisiones cerradas
- [x] Commit de 8.0 (docs) `ed9c280`

## 8.1 Precios

- [x] Motor puro TS + función SQL `numeric`
- [x] `payment_pricing_versions` + preview admin
- [x] Dual price en catálogo detrás de flag
- [x] Tests: 5,3119 %, ceil $100, múltiplo exacto, producto, combo, qty, cupón, envío, cambio de versión, snapshot, copy humana
- [x] Checks locales verdes (lint, tsc, 160 unitarios, reset, advisors, RLS 36, matriz, control negativo, build, PWA)
- [x] Integración local 7/7
- [x] Commit independiente `19d0cea`
- [x] Flag público apagado (versión 1 activa con dual/payments en false)
- [x] Push `main` + CI `32077144361` verde (lint-test-build, db-security, e2e)
- [x] Migración productiva `20260817222422` aplicada; flags off verificados
- [x] Smoke productivo 16/16

## 8.2 Core pagos y stock

- [ ] Tablas `order_payments`, `payment_events`, tokens
- [ ] Reserva al iniciar pago; restore en expire/cancel
- [ ] Cron oficial
- [ ] RLS / REVOKE / advisors
- [ ] Integración: idempotencia, concurrencia, approve vs expire, roles
- [ ] Commit independiente
- [ ] Prod solo con checks verdes y flags off

## 8.3 Transferencia

- [ ] Datos bancarios snapshot
- [ ] Token opaco
- [ ] Bucket `payment-receipts` privado
- [ ] Review admin
- [ ] E2E transferencia
- [ ] Commit / deploy apagado

## 8.4 Mercado Pago

- [ ] Preference + `X-Idempotency-Key`
- [ ] Webhook HMAC + GET canónico
- [ ] Retorno informativo
- [ ] Reembolsos
- [ ] Mocks / integración / E2E
- [ ] Commit / deploy apagado
- [ ] Credenciales solicitadas al propietario si faltan

## 8.5 Finanzas y administración

- [ ] Slice de caja sin duplicar 6.6
- [ ] Comisión real en margen de pagos
- [ ] Alertas de conciliación
- [ ] Panel completo
- [ ] Commit independiente

## 8.6 Release

- [ ] `supabase db reset --local`
- [ ] CI remoto verde
- [ ] Migraciones productivas
- [ ] Secrets
- [ ] Edge Functions
- [ ] Vercel READY
- [ ] Smoke productivo
- [ ] Aviso antes de cobro real
- [ ] Activación atómica
- [ ] `PLAN.md` + `ETAPA8_RELEASE_REPORT.md`

## Checks (usar equivalentes reales de `package.json`)

```
git diff --check
npm run lint
npm run test
npx tsc --noEmit --incremental false
npm run check:pwa-icons
npm run build
npm run db:reset
npm run db:types
npm run db:types:check
npm run db:advisors:security
npm run test:db-rls
npm run test:db-security
npm run test:db-insecure-control
npm run test:integration   # con STAGE8_* cuando existan
npx playwright test <specs Stage 8>
npm run test:smoke
```

## Registro

| Fecha | Subetapa | Commit | Deploy | Evidencia |
|---|---|---|---|---|
| 2026-08-17 | 8.0 docs | `ed9c280` | n/a | ADR + runbook + doc de producto |
| 2026-08-17 | 8.1 precios | `19d0cea` | migración prod + flags off | CI `32077144361`; smoke 16/16 |
