# Etapa 6.2 — Alertas de reposición (runbook)

- **Estado:** implementado y validado **localmente**. **No** desplegado.
- **No afirmar cierre productivo** hasta: commit, push, CI remoto verde,
  migración productiva, deploy Vercel `ilara` READY y smoke.
- **Stage 6 completo:** **no**. Sólo 6.2. Stage 6.1 permanece cerrado en prod.
- **Stage 7 / Envia.com:** **fuera de alcance** (sin código logístico).

## 1. Objetivo

Detectar productos con `stock <= min_stock`, presentar un panel operativo admin y
permitir tomar / resolver / descartar alertas con historial auditable. La
detección es **central en Postgres** (trigger), no depende de cada pantalla.

## 2. Alcance

- Tablas `stock_alerts` / `stock_alert_events`
- Trigger en `products` (INSERT/UPDATE de `stock`, `min_stock`)
- Una sola alerta activa por producto (`open` | `in_progress`)
- Auto-cierre al recuperar stock (`resolution_kind = auto_stock`)
- Nuevo ciclo si vuelve a caer
- Backfill de productos legacy bajo mínimo
- Panel `?tab=stock_alerts` + tile en Negocio
- RPC `transition_stock_alert` (admin)
- Tests unitarios, integración, E2E, suite DB

## 3. Fuera de alcance

- Envia.com, transportistas, cotización, etiquetas, tracking
- Órdenes de compra, proveedores, pagos, email/WhatsApp/push
- Devoluciones, margen, CRM, CxC/CxP
- Notificaciones externas

## 4. Arquitectura

| Capa | Ubicación |
|---|---|
| Trigger + sync | `sync_stock_alert_for_product`, `trg_products_sync_stock_alert` |
| RPC admin | `transition_stock_alert(uuid, text, text)` |
| Reglas puras | `lib/domain/stockAlerts/rules.ts` |
| Estados | `lib/domain/stockAlerts/states.ts` |
| Browser panel | `lib/domain/stockAlerts/browserStockAlerts.ts` |
| UI | `components/AlertasReposicion.tsx` |

Sin service role en app. Sin framework de estado global.

## 5. Modelo de datos

### `stock_alerts`

- `product_id` FK CASCADE
- `status`: open | in_progress | resolved | dismissed
- snapshots: stock/min al abrir y actuales
- `suggested_qty`, `deficit`
- `resolution_kind`: null | manual | auto_stock
- `assigned_to`, timestamps, `note`

Índice único parcial: una activa por `product_id`.

### `stock_alert_events`

Historial: from/to, actor, reason, meta, created_at.

### Migraciones

- `20260814090000_stage62_stock_alerts.sql`

La migración incluye grants explícitos para Data API y un advisory lock por
producto para serializar apertura/cierre durante backfill y reintentos concurrentes.

## 6. Máquina de estados

```
open → in_progress → resolved | dismissed
open → resolved | dismissed
(auto) open|in_progress → resolved (resolution_kind=auto_stock)
```

Terminales del ciclo: `resolved`, `dismissed`.
Reintento same-status: idempotente.

## 7. Cantidad sugerida (determinista)

```
target = min_stock <= 0 ? 1 : max(min_stock * 2, min_stock + 1)
suggested_qty = max(1, target - stock)
deficit = max(0, min_stock - stock)
```

No es predicción ni OC automática. Documentada y testeada en TS y SQL
(`stock_alert_suggested_qty`).

Urgencia de listado: mayor déficit → menor stock → más antigua.

## 8. Seguridad

- RLS SELECT solo `is_app_admin()`
- Sin INSERT/UPDATE/DELETE de tabla a authenticated (solo RPC/trigger)
- Anon: sin SELECT (grants revocados)
- `transition_stock_alert`: DEFINER, `search_path=''`, `is_app_admin()`
- Notas mín. 3 chars al resolver/descartar
- Matriz DB incluye `stock_alerts` / `stock_alert_events`

## 9. Observabilidad

Eventos (sin PII):

- `stock_alert_taken` / `resolved` / `dismissed` / `transition_failed`
- (apertura/auto en DB; opcional telemetría futura)

## 10. Validación local

| Check | Resultado |
|---|---|
| lint / tsc / unit (119) | OK |
| build / pwa-icons | OK |
| db reset + types | OK |
| db-rls / db-security / insecure-control | OK |
| db:advisors:security | 0 issues |
| integración Stage 6.2 | 9/9 (incluye concurrencia) |
| E2E `stock-alerts.spec.ts` | 1/1 OK |

## 11. Deploy (cuando se autorice)

1. Backup / ventana breve si aplica.
2. Aplicar migración `20260814090000` en Supabase remoto.
3. Verificar anon deny en `stock_alerts*`.
4. Deploy Vercel **`ilara`** desde `main`.
5. Smoke: login admin → Negocio → Alertas de stock; contador; tomar/resolver en producto de prueba.
6. Actualizar docs con evidencia.

## 12. Rollback / forward-fix

- **Código:** revert deploy; tile/tab dejan de usarse.
- **DB:** no borrar filas con historial. Forward-fix: `DROP TRIGGER products_sync_stock_alert` y/o `REVOKE EXECUTE ON transition_stock_alert FROM authenticated`.
- No reescribir migraciones históricas.

## 13. Riesgos residuales

- Resolver/descartar con stock aún bajo no reabre hasta el próximo cambio de stock/min (nuevo ciclo).
- Sin notificaciones push/email.
- Sin órdenes de compra.
- Contraste residual en catálogo/panel no relacionado.

## 14. Criterio de cierre productivo

- [ ] Commit + push + CI verde
- [ ] Migraciones productivas
- [ ] Deploy READY + smoke
- [ ] Revisión humana

Hasta entonces: **implementado localmente, pendiente de release.**
