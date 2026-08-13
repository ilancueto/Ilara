# Etapa 6.1 — Pedidos desde el catálogo (runbook)

- **Estado:** implementado y validado **localmente**. **No** desplegado.
- **No afirmar cierre productivo** hasta: commit, push, CI remoto verde,
  migración productiva, deploy Vercel `ilara` READY y smoke productivo.
- **Stage 6 completo:** **no**. Sólo 6.1. Iniciativas 6.2–6.7 y **toda** la
  Etapa 7 (envíos/logística) quedan fuera de alcance.

## 1. Objetivo

Convertir el carrito público (antes solo WhatsApp) en un **pedido persistente**,
con número legible, precios autoritativos, estados auditables y control de stock
en la confirmación administrativa.

## 2. Alcance

- Creación pública de pedidos desde el catálogo (Server Action + RPC).
- Snapshots de líneas (nombre, precio, descuento, composición de combo).
- Cupón revalidado en Postgres.
- Idempotencia por `idempotency_key`.
- Panel admin: listar, buscar, detalle, historial, transiciones.
- WhatsApp como **continuación** opcional del pedido ya persistido.
- Tests unitarios, integración local, E2E local (loopback).

## 3. Fuera de alcance (explícito)

- Stage 6.2–6.7 (reposición, devoluciones, margen, CRM, CxC/CxP, B2B).
- **Stage 7 completo:** transportistas, Correo Argentino, OCA, Andreani,
  agregadores, cotización por CP, tarifas, sucursales, etiquetas, tracking,
  alta de envíos, credenciales logísticas, campos de envío en el pedido.
- Tracking público por token (pospuesto; confirmación inmediata alcanza).
- CAPTCHA externo (rate limit por teléfono en RPC + límites de payload).
- Conversión automática de pedido a venta POS.

## 4. Arquitectura

| Capa | Ubicación |
|---|---|
| RPC create (anon) | `create_catalog_order(jsonb)` |
| RPC transition (admin) | `transition_catalog_order(uuid, text, text)` |
| Domain puro | `lib/domain/orders/*` |
| DAL server-only | `lib/dal/orders.ts` |
| Server Action | `app/actions/orders.ts` |
| Panel browser + RLS | `lib/domain/orders/browserOrders.ts` |
| Checkout UI | `components/Catalogo/CheckoutPedido.tsx` |
| Admin UI | `components/Pedidos.tsx` · tab `orders` |

- **Sin service role en app.**
- Cliente público (anon) para crear; browser autenticado + `is_app_admin()` para admin.
- Precios: **catálogo** (`sale_price` con `discount_percentage` de producto + cupón).
  Distinto del POS (lista sin descuento de catálogo).

## 5. Modelo de datos

- `orders` — UUID, `order_number` (`IL-######`), estado, canal `catalog`,
  `idempotency_key`, fingerprint del request, contacto mínimo, montos, cupón snapshot,
  `stock_reserved`, timestamps.
- `order_items` — snapshots + ID histórico del producto + `combo_components_snapshot` jsonb.
- `order_status_events` — from/to, actor, motivo, fecha.
- Secuencia: `catalog_order_number_seq`.

Migración: `supabase/migrations/20260813205545_stage61_catalog_orders.sql`.

## 6. Máquina de estados

```
pending → confirmed → preparing → ready → completed
   │          │           │         │
   └──────────┴───────────┴─────────┴→ cancelled
```

| Transición | Stock |
|---|---|
| → confirmed (desde pending) | Reserva atómica (FOR UPDATE); una sola vez |
| → cancelled (si stock_reserved) | Restaura exacto desde snapshots de combo/producto |
| → cancelled (pending) | Sin restore |
| same status | Idempotente (no repite efectos) |
| completed / cancelled | Terminales |

Motivo obligatorio al cancelar (≥ 3 caracteres).

## 7. Reglas de precios y cupones

1. Cliente envía solo IDs, cantidades, cupón y datos de contacto.
2. RPC **rechaza** `total` / `subtotal` / `unit_price` en el payload.
3. Productos: deben estar `visible_in_catalog` y con precio > 0.
4. Combos: `is_active` y con `combo_items`.
5. Unitario producto = `round(sale_price * (1 - discount%/100), 0)`.
6. Combo = `round(sale_price, 0)`.
7. Cupón: activo, % sobre subtotal, `round`.
8. Snapshots guardan el resultado histórico.

## 8. Seguridad y privacidad

- RLS: SELECT solo `is_app_admin()`; sin INSERT/UPDATE/DELETE directos.
- REVOKE ALL a `anon` en tablas; EXECUTE de create a `anon`/`authenticated`.
- Transition: solo `authenticated` + `is_app_admin()`.
- Sin lectura anónima enumerable de pedidos.
- Logs: eventos `order_create_*` / `order_status_changed` sin teléfono/email/notas.
- Rate limit: máx. 8 pedidos por teléfono / hora.
- El límite y la idempotencia se serializan con advisory locks transaccionales.
- Un producto con stock reservado por un pedido operativo no puede eliminarse.
- Límites: 40 líneas, qty ≤ 99, nombre ≤ 80, notas ≤ 500, teléfono 8–15 dígitos.

## 9. Idempotencia

- `orders.idempotency_key` UNIQUE.
- Reintento con la misma clave devuelve el mismo pedido (`idempotent_replay`).
- La misma clave con un payload diferente se rechaza (`idempotency_conflict`).
- Reintentos simultáneos con la misma clave convergen en un único pedido.
- Transición al mismo estado: no re-descuenta ni re-restaura.

## 10. Validación local ejecutada

| Check | Resultado |
|---|---|
| `npm run lint` | OK |
| `npx tsc --noEmit --incremental false` | OK |
| `npm run test` | 111 passed |
| `npm run build` | OK |
| `npm run check:pwa-icons` | OK |
| `supabase db reset --local` | OK (migración 6.1 aplicada) |
| `npm run db:types` / `db:types:check` | OK |
| `npm run test:db-rls` | OK (orders + items + events) |
| `npm run test:db-security` | OK (anon denegado en orders*) |
| `npm run test:db-insecure-control` | OK |
| `npm run db:advisors:security` | OK, sin issues |
| Integración Stage 6.1 (`STAGE61_INTEGRATION=1`) | 10/10 OK |
| E2E `orders-catalog.spec.ts` (Playwright, E2E_* loopback) | 1/1 OK |

## 11. Plan de deploy (cuando se autorice)

1. Backup / ventana de mantenimiento breve si aplica.
2. Aplicar migración `20260813205545_stage61_catalog_orders.sql` en Supabase remoto
   (CLI o flujo versionado del proyecto; **no** SQL ad-hoc sin versionar).
3. Verificar advisors y grants (anon sin SELECT en `orders*`).
4. Deploy Vercel proyecto **`ilara`** desde `main` (nunca `ilara-app`).
5. Smoke read-only: catálogo 200, login, crear pedido de prueba en staging/local
   o pedido real controlado; confirmar en panel; cancelar restore.
6. Actualizar `AUDITORIA.md` / `PLAN.md` con commit y evidencia.

## 12. Rollback / forward-fix

- **Código:** revertir deploy Vercel a release anterior (checkout sigue en WhatsApp fallback).
- **DB:** no borrar tablas con datos reales. Forward-fix: deshabilitar EXECUTE de
  `create_catalog_order` a `anon` si hay abuso; o feature-flag UI (ocultar checkout).
- No reescribir migraciones históricas.

## 13. Smoke productivo (post-deploy, solo lectura / controlado)

- `GET /catalogo` 200.
- Login admin.
- `/?tab=orders` carga panel.
- Probe: `anon` SELECT `orders` → deny/401.
- Pedido de prueba real solo con aprobación de negocio.

## 14. Riesgos residuales

- Rate limit por teléfono es simple (no WAF/CAPTCHA); abuso distribuido posible.
- Sin tracking público: el cliente solo ve el número en la confirmación.
- Coordinación de entrega manual (WhatsApp) hasta Stage 7.
- E2E de pedidos puede ser frágil si el catálogo no indexa el producto seed a tiempo.
- Componentes de catálogo/panel siguen grandes (deuda Stage 5 residual).

## 15. Criterio de cierre de Stage 6.1 (productivo)

- [ ] Commit en `main`
- [ ] Push + CI remoto verde
- [ ] Migración productiva aplicada
- [ ] Deploy Vercel `ilara` READY
- [ ] Smoke + pedido de prueba controlado
- [ ] Revisión humana
- [ ] Docs actualizados con evidencia

Hasta entonces: **implementado localmente, pendiente de revisión y release.**
