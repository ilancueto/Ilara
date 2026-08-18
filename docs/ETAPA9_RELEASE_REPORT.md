# Informe de cierre — Stage 9

Fecha: 2026-08-18  
Rama: `main`  
Flags Stage 8: apagados  
Pagos reales: no ejecutados

## 1. Subetapas

| Subetapa | Estado |
| --- | --- |
| 9.1 Cliente unificado | Hecho |
| 9.2 Margen consolidado | Hecho |
| 9.3 Devoluciones por canal | Hecho |
| 9.4 Armonía de interfaz | Hecho |
| 9.5 Docs, tests y validación local | Hecho |
| CI GitHub Actions | Pendiente de verde tras el push |
| Migración producción + smoke Vercel | Pendiente de aplicar después del verde local/CI |

## 2. Archivos y migraciones nuevas

Migraciones:

- `supabase/migrations/20260818023000_stage91_order_customer.sql`
- `supabase/migrations/20260818024000_stage92_commercial_margin.sql`
- `supabase/migrations/20260818025000_stage93_order_returns.sql`

Documentación:

- `docs/ETAPA9_INTEGRACION_ADR.md`
- `docs/ETAPA9_RUNBOOK.md`
- `docs/ETAPA9_RELEASE_REPORT.md`

## 3. Datos y compatibilidad

- `orders.customer_id` es nullable. Históricos se vinculan sólo si el teléfono coincide con un único cliente.
- Casos 0 o varios clientes quedan en `order_customer_link_audit`.
- Snapshots de nombre, teléfono y email del pedido no se reescriben.
- Costos de pedidos anteriores quedan como “costo no disponible”.
- `sales_margin_report` y `sale_returns` no se modifican.
- Un pedido web no entra en `sales` ni su cobro en `incomes`.

## 4. Evidencia local ejecutada

| Chequeo | Resultado |
| --- | --- |
| `npm run db:reset` | OK, aplica 9.1–9.3 |
| `npm run db:types` | OK |
| `npm run db:types:check` | OK |
| `npm run lint` | OK |
| `npx tsc --noEmit --incremental false` | OK |
| `npm run test` | 185 passed |
| Integración Stage 9 | 9 passed |
| Integración 6.1 / 6.3 / 6.4 / 6.5 | passed (6.1 tras CASCADE de componentes) |
| `npm run test:db-rls` | OK, 47 tablas |
| `npm run test:db-security` | OK, incluye tablas 9.x |
| `npm run test:db-insecure-control` | OK |
| `npm run db:advisors:security` | sin issues |
| `npm run build` | OK, Next.js 16.3.0 |
| E2E `e2e/stage9-ops.spec.ts` | 1 passed |

## 5. Riesgos residuales

- Pedidos históricos sin teléfono único quedan sin ficha CRM.
- Pedidos anteriores pueden mostrar margen de catálogo incompleto.
- El reembolso de Mercado Pago no se dispara solo; hay que registrarlo a propósito.
- GitHub Actions `*/5` puede atrasarse bajo carga (limitación ya documentada en Stage 8).

## 6. Pendiente del dueño

- Datos bancarios reales.
- Confirmar token de prueba vs vivo y liquidación a 10 días.
- Desplegar funciones de Mercado Pago.
- Autorizar el encendido de flags. **No encender ahora.**

## 7. Hash, CI y deploy

Se completan al pushear y verificar CI / Vercel.
