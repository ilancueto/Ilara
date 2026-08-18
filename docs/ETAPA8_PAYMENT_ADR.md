# ADR — Etapa 8 Pagos online

- **Estado:** aceptado para implementación (Stage 8.0 cerrado en documentación).
- **Fecha:** 2026-08-17
- **HEAD auditado:** `28dd208` (`main`, origin/main).
- **Fuera de este ADR:** código, migraciones y activación pública.

## 1. Contexto auditado

Stages 0–7 están cerrados en producción (`ilara.com.ar`, proyecto Supabase
`qbbnvdmadgomfmrsfxlo`). El working tree de Stage 8 parte de `28dd208`. Los
únicos paths no versionados del propietario son `.cursor/`, `AGENTS.md`,
`CLAUDE.md` y `mockups/ilara-suite-overhaul/`; no se tocan.

### 1.1 Qué existe y es autoridad

| Superficie | Autoridad real | Implicancia Stage 8 |
|---|---|---|
| Precio de catálogo | `products.sale_price` + `discount_percentage`; combo `sale_price`; RPC `create_catalog_order` | El cliente no puede enviar totales. Hoy `sale_price` **es** el precio que paga el comprador. |
| Cupón | Revalidado en Postgres, % sobre subtotal, `round(..., 0)` | Hay que aplicar el mismo % a base y a público, no un “ahorro %” inventado. |
| Envío | Snapshot `shipping_quotes`; el wrapper consume `shipping_quote_id` y suma `shipping_amount` al total | El envío entra al importe cobrable. Mismo motor de gross-up. |
| Stock de pedido | `transition_catalog_order`: reserva **solo** `pending → confirmed` si `stock_reserved` es falso; restaura si cancela y `stock_reserved` | Stage 8 reserva al **iniciar el pago**, con el pedido todavía `pending`. |
| Estados de pedido | `pending → confirmed → preparing → ready → completed` y `cancelled` | No se mezclan con estados de pago. |
| Devoluciones 6.3 | Solo ventas POS (`sale_returns`). No hay devolución física de pedidos de catálogo | Un reembolso financiero no toca stock. Cancelar un pedido reservado sí. |
| Margen 6.4 | Solo ventas POS. Excluye `pending_payment`. No incluye comisiones | No convertir pedidos en `sales`. Extender margen con una vista de pagos, no reescribir 6.4. |
| Finanzas 6.6 | Libro de CxC/CxP atado a `sales` + `incomes` + `expenses` + `sale_returns` | Insertar un pedido cobrado como `incomes` o como venta POS **duplicaría** caja. |
| Comprobantes POS | Bucket `receipts` privado, 5 MB, prefijo `{auth.uid()}/` | El comprador es anónimo. No se reutiliza ese bucket para comprobantes de transferencia. |
| Integraciones | Edge Functions `shipping-quotes` y `passkey-auth`; secretos solo en Supabase; `verify_jwt = false` + auth propia | Mercado Pago sigue ese patrón. Cero `service_role` y cero `NEXT_PUBLIC_*` de tokens MP. |
| Cron | No hay jobs hoy | Intento inicial: `cron.schedule(...)` (API oficial). Nunca `UPDATE cron.job`. **Corrección 8.3:** producción no tiene `pg_cron`; la expiración vive en Vercel Cron + Route Handler autenticado con `CRON_SECRET` + `service_role`. |
| Next.js 16.3 | Server Actions = POST alcanzable; Route Handlers en `app/**/route.ts` | Acciones públicas y admin con `'use server'`. Webhook **no** vive en Next. |

Hallazgo de stock que el ADR fija: `transition_catalog_order` **ya** restaura
si `stock_reserved` es verdadero, incluso desde `pending`. El espejo TypeScript
`transitionMayRestoreStock` está desactualizado (niega restore desde pending).
La SQL es la autoridad; el espejo se corregirá en 8.2.

Hallazgo de wrap Stage 7: `create_catalog_order` fue renombrado a
`create_catalog_order_core_stage61` y envuelto. Stage 8 no reabre el núcleo
6.1: o lo envuelve de nuevo, o extrae helpers `private.*` y los llama desde
el wrapper vigente.

### 1.2 Decisiones de negocio ya cerradas

- Solo pago total. No hay señas ni cuotas internas del pedido.
- Métodos: Mercado Pago (Checkout Pro) y transferencia bancaria directa.
- Acreditación operativa elegida: 10 días. La tarifa de referencia inicial es
  4,39 % + IVA ≈ 5,3119 %. No es una constante eterna.
- El catálogo muestra desde el inicio precio público y precio por transferencia.
- Mercado Pago cobra el público. Transferencia cobra la base.
- Redondeo: techo al próximo múltiplo de $100.
- El ahorro de transferencia es `público − base`, no un % marketing.
- Reserva: MP 30 min; transferencia 24 h (configurables).
- Kill switch de toda la capa, de MP y de transferencia, sin borrar datos.
- Textos públicos humanos. Cero jerga interna.

## 2. Decisión

Construir una **capa de pagos y precios versionada** al lado del pedido, no
dentro de la máquina operativa. `sale_price` permanece como **precio base /
transferencia**. El precio público se deriva, se versiona y se snapshotéa.

Toda mutación de dinero, stock o estado de pago ocurre en Postgres o en Edge
Functions con `service_role`. El navegador solo envía IDs, cantidades, método
elegido y, cuando corresponde, el token opaco.

La capa nace **apagada**. Se enciende de forma atómica en Stage 8.6.

## 3. Modelo de precios

### 3.1 Invariantes

1. No se hace `UPDATE products.sale_price` para “cubrir la comisión”.
2. No se aplican porcentajes acumulativos sobre un precio ya aumentado.
3. El motor autoritativo es `numeric` en Postgres (`numeric(12,2)` importes,
   `numeric(12,8)` tasa). TypeScript puede espejar para UX y tests; si
   discrepa, gana Postgres.
4. Un pedido histórico conserva la versión y los importes del momento. Un
   cambio posterior de comisión no lo reescribe.
5. El payload del cliente con `total`, `subtotal`, `unit_price`,
   `public_price` o `amount_due` se rechaza (`client_price_not_allowed`).

### 3.2 Fórmula (versión 1, reemplazada)

La comisión + redondeo **ya no define** el precio de la clienta. Queda como
registro histórico. La regla vigente está en 3.2.1.

### 3.2.1 Fórmula vigente (10% transferencia)

```
list / Mercado Pago = sale_price (después de descuento de producto y cupón)
transfer            = round(merch_list * (1 - 0.10))
shipping            = igual en ambos medios
saving              = list - transfer   (solo mercadería)
```

Ejemplo: lista `100000` + envío `8000` → Mercado Pago `108000` →
transferencia `98000`. Pedidos y pagos ya grabados no se reescriben.

### 3.2.2 Fórmula histórica (comisión + redondeo)

```
public_raw = base / (1 - effective_fee_rate)
public     = ceil(public_raw / rounding_increment) * rounding_increment
transfer   = base
saving     = public - transfer
```

Valores iniciales:

- `effective_fee_rate = 0.053119`
- `rounding_increment = 100`

Ejemplo obligatorio: base `100000` → raw `≈ 105609.75` → público `105700` →
ahorro `5700`.

`ceil` monetario en Postgres se implementa con aritmética `numeric`, no
`float8`. Patrón previsto:

```
ceil(public_raw / rounding_increment) * rounding_increment
```

usando `numeric` de punta a punta.

La tasa listada 4,39 % y el IVA 21 % son **ayuda administrativa**. No entran
en el cálculo. Si mañana cambia la comisión real de la cuenta, se activa una
**nueva versión** con la tasa efectiva nueva.

### 3.3 Aplicación a líneas, cupón y envío

Sobre cada línea, la **base** es la regla 6.1 vigente:

- producto: `round(sale_price * (1 - discount%/100), 0) * qty`
- combo: `round(sale_price, 0) * qty`

Luego, por línea (o por unidad, de forma equivalente y determinista):

- `unit_public = ceil_inc(unit_base / (1 - fee))`
- `line_public = unit_public * qty`

Cupón: el mismo `discount_percentage` se aplica al **subtotal base** y al
**subtotal público**, con `round(..., 0)` en cada uno. No se inventa un
porcentaje de ahorro.

Envío: `shipping_base = shipping_quotes.amount` (autoridad Envia).
`shipping_public = ceil_inc(shipping_base / (1 - fee))`.

Totales del pedido:

```
base_total    = base_subtotal - base_coupon + shipping_base
public_total  = public_subtotal - public_coupon + shipping_public
transfer_due  = base_total
mp_due        = public_total
transfer_saving = public_total - base_total
```

`orders.total` **conserva el significado actual** (total base / transferencia)
y la constraint `total = subtotal - discount_total + shipping_amount`. Se
agregan columnas nuevas para el público. No se reinterpreta el historial.

### 3.4 Versionado

Tabla `payment_pricing_versions`:

- `version_number` entero monótono
- `effective_fee_rate`, `rounding_increment`
- campos de ayuda: `listed_fee_rate`, `iva_rate` (no calculan)
- reservas: `mp_reservation_minutes` (30), `transfer_reservation_hours` (24)
- kill switches: `payments_enabled`, `mercado_pago_enabled`,
  `bank_transfer_enabled`, `catalog_dual_price_visible`
- datos bancarios vigentes al activar (CBU, alias, banco, titular, CUIT,
  texto, `receipt_required`)
- `activated_by`, `activated_at`, `superseded_at`
- una sola fila `status = 'active'`; drafts para preview

“Aplicar precios” **activa una versión**. Restaurar = activar un clon de una
versión anterior como nueva fila (forward-only, auditable). El preview admin
muestra N productos/combos afectados y muestras antes/después **sin escribir**
`sale_price`.

Hasta 8.6: la versión activa existe pero todos los flags públicos quedan en
`false`. El catálogo sigue mostrando un solo precio (`sale_price`).

## 4. Modelo de pagos

### 4.1 Dos máquinas

Pedido (sin cambios de grafo):

```
pending → confirmed → preparing → ready → completed
                ↘ cancelled
```

Pago (nueva):

```
pending → requires_review → approved
   │            │
   ├→ rejected  ├→ rejected
   ├→ cancelled ├→ cancelled
   └→ expired   └→ expired

approved → partially_refunded → refunded
```

Métodos normalizados de esta capa (distintos del enum POS):

- `mercado_pago`
- `bank_transfer`

Proveedor: `mercado_pago` | `manual`. Moneda: `ARS`.

### 4.2 Tablas

Nombres alineados al repo (snake_case, schema `public`, RLS + REVOKE).

1. `payment_pricing_versions` — ver 3.4.
2. `order_payments` — un intento controlado por fila:
   - `idempotency_key` UNIQUE
   - `order_id`, `pricing_version_id`
   - `method`, `provider`, `status`, `currency`
   - `base_amount`, `public_amount`, `transfer_saving`, `amount_due`
   - `estimated_fee`, `actual_fee`, `net_received`, `refunded_amount`
   - `provider_preference_id`, `provider_payment_id`, `external_reference`
   - `collector_id` (para verificar que el pago es de nuestra cuenta)
   - `expires_at`, `approved_at`, `rejected_at`, `cancelled_at`, `refunded_at`
   - `expected_available_at` (aprobado + 10 días; campo **operativo**, no un
     parámetro inventado de la Preferences API)
   - `reconciled_at`
   - timestamps
   - snapshot bancario desnormalizado si el método es transferencia
3. `payment_events` — append-only:
   - `provider_event_id` UNIQUE cuando exista
   - `event_type`, `normalized_status`
   - `payload_hash` (sha256 de un subset no sensible)
   - `processing_result` (`accepted` | `duplicate` | `rejected` | `ignored_stale`)
   - sin PAN, CVV, email, teléfono, domicilio, ni payload crudo completo
4. `payment_receipts` — metadatos del archivo (nunca el binario):
   - `storage_path` no enumerable, `sha256`, mime, size, `uploaded_at`
5. `payment_access_tokens` — solo hash:
   - `token_hash` UNIQUE, `order_id`, `payment_id`, `expires_at`,
     `consumed_at`, `last_used_at`
   - el plaintext se devuelve **una sola vez** al iniciar el pago

Opcional 8.5: `payment_reconcile_findings` (alertas, no mutan saldos).

### 4.3 Intentos

Un pedido `pending` admite **un** pago no terminal a la vez. Un rechazo,
cancelación o expiración permite un nuevo intento (nueva fila, nueva
idempotency key, mismo `order_id`). Un aprobado bloquea nuevos cargos.

No hay pago parcial del pedido. `amount_due` es siempre el total del método.

## 5. Flujo

```
Catálogo (flag off: un precio; flag on: público + transferencia)
        ↓
Checkout: cotiza envío (Stage 7, sin cambios de contrato)
        ↓
create_catalog_order  → pedido pending, stock_reserved=false
        ↓
UI elige método (solo si payments_enabled)
        ↓
start_order_payment   → reserva stock atómica
                      → crea order_payments pending
                      → emite token opaco una vez
        ├─ bank_transfer → muestra CBU/alias snapshot
        │                 → comprador sube comprobante (si aplica)
        │                 → requires_review
        │                 → admin aprueba / rechaza
        └─ mercado_pago  → Edge Function crea Preference
                          → redirect init_point
                          → webhook firmado + GET /v1/payments/{id}
                          → approved | rejected | cancelled | expired
        ↓
pago approved → transition pedido pending→confirmed (sin re-reservar)
        ↓
expiración / rechazo / cancelación de pending
        → libera stock si estaba reservado
        → pedido cancelled (motivo de sistema)
```

La URL de retorno de Checkout Pro (`back_urls`) es informativa. La página
pública consulta estado con el token opaco. **Nunca** marca `approved`.

### 5.1 Stock y concurrencia

- Locks: `SELECT … FOR UPDATE` sobre `orders` y `products` en el mismo orden
  que 6.1 (`ORDER BY product_id`) más `pg_advisory_xact_lock` por
  `order_id` / `idempotency_key`.
- `start_order_payment` reserva si `stock_reserved` es falso.
- `pending → confirmed` posterior **no** vuelve a descontar.
- Cancelación/expiración restaura si `stock_reserved` es verdadero, aunque el
  pedido siga `pending`.
- Webhook duplicado: `provider_event_id` UNIQUE + lock; segundo evento
  `duplicate`, HTTP 200, cero stock.
- Aprobación vs expiración simultáneas: el lock de `order_payments` serializa.
  Si ya está `approved`, el cron no toca.
- Reembolso financiero: no incrementa `products.stock`. La autoridad de
  retorno físico sigue siendo 6.3 (POS) o una cancelación de pedido que aún
  tenga reserva.

Cuando `payments_enabled = true`:

- un admin **no** puede `pending → confirmed` si no hay pago `approved`;
- sí puede cancelar (libera stock, marca el pago `cancelled` si seguía abierto).

Cuando el flag está apagado, 6.1 queda intacto.

### 5.2 Cron de expiración

Job `expire-catalog-payments` vía `cron.schedule('expire-catalog-payments',
'*/5 * * * *', $$SELECT public.expire_catalog_payments()$$)` después de
`CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions` (o el schema
que documente el proyecto al momento de implementar; se confirma con
`--help` / advisors, no se asume).

La función:

1. toma filas `pending`/`requires_review` con `expires_at <= now()`;
2. lock por fila;
3. ignora `approved` y reembolsos;
4. pasa el pago a `expired`;
5. si el pedido está `pending` y reservó, cancela y restaura;
6. escribe `payment_events` + `order_status_events` (`actor_kind = 'system'`).

Idempotente. No edita `cron.job` a mano.

## 6. Transferencia

Datos bancarios viven en la versión de precios y se **copian** al pago.

- Comprador anónimo: no hay policy de Storage para `anon`.
- Upload: Edge Function `payments-transfer-receipt` valida token, mime
  (jpeg/png/webp/pdf), tamaño ≤ 5 MB y magic bytes razonables; escribe con
  `service_role` a bucket privado `payment-receipts`.
- Path: `{order_id}/{payment_id}/{random}`; no se revela al cliente.
- Al adjuntar: `pending → requires_review`.
- Admin aprueba o rechaza (motivo ≥ 3 caracteres). RPC `is_app_admin()`.
- URL firmada corta solo para admin.
- Retención: se conserva mientras exista el pago; no se borra en kill switch.
  Una política de purge, si se pide, será migración posterior.

`receipts` (POS) no se reutiliza: su contrato es `{auth.uid()}/` y el
comprador no tiene sesión.

## 7. Mercado Pago (oficial)

Fuentes consultadas el 2026-08-17 (sitio `.com.ar`, Checkout Pro):

- [Checkout Pro overview](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/overview)
- [Crear preferencia](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro/create-payment-preference)
- [back_urls](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro/configure-back-urls)
- [Webhooks](https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks)
- [Notificaciones Checkout Pro](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro/payment-notifications)
- [Reembolsos](https://www.mercadopago.com.ar/developers/en/reference/online-payments/checkout-pro/create-refund/post)

### 7.1 Preferencia

Edge Function `payments-mp-preference`:

- Auth: token opaco, no JWT de usuario.
- Lee `amount_due` y moneda desde DB. Un solo item: título humano del pedido
  (`Pedido IL-######`), `quantity = 1`, `unit_price = amount_due`.
- `external_reference` = UUID interno del pago (no el teléfono).
- `X-Idempotency-Key` = `order_payments.idempotency_key` (UUID, 1–150 chars).
- `notification_url` de esta preferencia apunta al webhook (tiene prioridad
  sobre la URL de “Tus integraciones”).
- `back_urls.success|pending|failure` → página pública `/pedido/estado`.
- `auto_return = approved` (redirección informativa, hasta 40 s).
- `expires` / `expiration_date_to` alineados a `expires_at` (30 min).
- Respuesta al cliente: solo `init_point` o `sandbox_init_point`.
- Rate limit por hash de IP + por token, mismo estilo que Stage 7.
- No se envían `NEXT_PUBLIC_` tokens. Access token solo en secreto
  `MERCADOPAGO_ACCESS_TOKEN`.

La acreditación a 10 días **no se inventa como campo de Preference**. Se
configura en la cuenta de Mercado Pago (liberación de dinero). El sistema
guarda `expected_available_at = approved_at + 10 days` para el panel. Antes
de 8.6 el propietario confirma en el panel de MP que la cuenta está en
acreditación 10 días y la tasa efectiva vigente.

### 7.2 Webhook

Edge Function `payments-mp-webhook`, `verify_jwt = false`.

Validación oficial de origen:

1. Leer `x-signature` (`ts=…,v1=…`) y `x-request-id`.
2. Tomar `data.id` del query (así lo documenta MP; no confiar solo en el body).
3. Validar HMAC según el algoritmo vigente de
   `WebhookSignatureValidator` / docs de webhooks.
4. Si falla o falta firma → 401. Sin body interno.
5. Responder 200/201 en < 22 s para el ACK; el trabajo pesado ocurre en la
   misma request si entra en el presupuesto, o se registra y se reconcilia.

Después del ACK de firma:

1. `GET https://api.mercadopago.com/v1/payments/{id}` con el access token.
2. Verificar `external_reference`, `currency_id = ARS`,
   `transaction_amount = amount_due`, `collector_id` = el de la cuenta.
3. Mapear `status` MP → estado interno (`approved`, `rejected`, `cancelled`,
   `refunded`, etc.). Eventos fuera de orden: un estado terminal no retrocede
   salvo reembolso documentado.
4. Persistir `fee_details` / `transaction_details.net_received_amount` cuando
   existan como `actual_fee` y `net_received`.
5. Idempotencia por `provider_event_id` y por `provider_payment_id`.

Topics a suscribir en Tus integraciones: `payment` (Checkout Pro) y, para
contracargos, `topic_chargebacks_wh`. IPN no se usa (deprecado).

Nota oficial: los pagos de prueba creados con credenciales de test **no
envían** webhooks reales; se simulan desde Tus integraciones. El E2E de 8.4
cubre firma/mocks y, si hay credenciales, un flujo sandbox + simulador.

### 7.3 Reembolsos

`POST /v1/payments/{id}/refunds` con `X-Idempotency-Key`. Si se envía
`amount`, es parcial; si no, total. No se excede `amount_due - refunded_amount`.

Transferencia: reembolso **manual** registrado por admin (sin llamar a MP).

Ningún reembolso crea `sale_returns` ni `incomes` negativos. Evita duplicar
6.3/6.6.

### 7.4 Edge Functions previstas

| Función | Rol |
|---|---|
| `payments-mp-preference` | Crear Preference |
| `payments-mp-webhook` | Recepción pública firmada |
| `payments-mp-reconcile` | GET canónico + cron/admin |
| `payments-mp-refund` | Reembolso MP (solo admin) |
| `payments-transfer-receipt` | Upload de comprobante |

## 8. Finanzas y margen (sin duplicar)

Stage 6.6 suma:

- ventas POS cobradas que **no** tienen CxC
- cobros de CxC
- `incomes`
- menos `expenses` y `sale_returns` (excepto `credito_cancelado`)

Un pedido de catálogo **no es** una fila de `sales`. Por lo tanto:

- No se inserta en `sales` al aprobar.
- No se inserta en `incomes` al aprobar.
- No se crea CxC automática.

Stage 8.5 extiende el snapshot financiero (función nueva
`finance_stage8_payments_slice` o ampliación explícita y testeada de
`finance_stage66_snapshot`) para **unir** inflows/outflows de
`order_payments` aprobados/reembolsados, etiquetados como origen `catalog_payment`.
La UI de conciliación muestra el corte POS y el corte online por separado y
un neto combinado, para que un humano no cargue el mismo cobro como “otro
ingreso”.

Margen 6.4 sigue siendo POS. El panel de 8.5 agrega:

- bruto cobrado (`amount_due` aprobado)
- comisión estimada vs real
- neto
- diferencia de fee
- reembolsos

Alertas de conciliación (solo hallazgos, no asientos automáticos):

- pago approved sin pedido
- pedido confirmed sin pago approved (con flag on)
- importe o moneda distintos
- pago duplicado (`provider_payment_id` repetido)
- webhook recibido y GET pendiente/fallido
- comisión real ≠ estimada (tolerancia configurable, default $1)
- transferencia vencida
- transferencia `requires_review` vieja
- reembolso inconsistente
- approved sobre pedido `cancelled`

## 9. Seguridad

- RLS on en toda tabla nueva.
- `REVOKE ALL … FROM PUBLIC, anon, authenticated`.
- `GRANT` mínimo a `service_role`.
- Admin: `SELECT` solo donde haga falta para el panel **o** cero SELECT y
  lectura vía RPC (preferible, como 6.6). Decisión de implementación 8.2:
  **cero SELECT autenticado** en `order_payments` / `payment_events`; todo
  pasa por RPC `SECURITY DEFINER` con `search_path = ''`, `auth.uid()` e
  `is_app_admin()`.
- `anon` no enumera pedidos ni pagos.
- Token opaco: ≥ 32 bytes CSPRNG, SHA-256, una sola exposición, no listable.
- Logs: reutilizar `observability/sanitize`. Eventos
  `payment_*` sin PII, sin paths de storage, sin tokens, sin firmas.
- Next.js no recibe `service_role` ni access token MP.
- Server Actions se tratan como POST públicos (Next 16). Autorización adentro.

Amenazas y mitigación:

| Amenaza | Mitigación |
|---|---|
| Manipular importe en el cliente | RPC ignora y rechaza campos de precio |
| Confirmar por `back_urls` | UI informativa; solo webhook+GET o aprobación admin |
| Webhook forjado | HMAC `x-signature` + GET canónico + collector_id |
| Replay | UNIQUE event id + locks |
| Carrera approve/expire | `FOR UPDATE` del pago |
| Doble reserva | `stock_reserved` + mismo helper |
| Enumerar pedidos | sin SELECT anon; token no adivinable |
| Subir malware al bucket | allowlist mime + magic + 5 MB + path opaco |
| Secretos en bundle | solo Edge secrets |
| Duplicar caja 6.6 | no escribir `sales`/`incomes` |

## 10. UI

Pública (detrás de flags):

- Precio grande = público. Línea secundaria:
  `$100.000 pagando por transferencia bancaria`.
- Checkout:

  ```
  Mercado Pago                  $105.700
  Transferencia bancaria        $100.000
  Ahorrás                         $5.700
  ```

- Cero palabras `fee`, `gross-up`, `pricing version`, `webhook`, `provider`.
- Teclado, labels reales, loading/error/reintento, un solo submit, no pierde
  la cotización de envío, mobile y dark mode, PWA intacta.

Admin:

- Tab de configuración de pagos (en Negocio o Pedidos): flags, tasa, redondeo,
  vencimientos, datos bancarios, preview, activar/restaurar versión, historial.
- Detalle de pedido: método, estado de pago, importes, fees, acreditación,
  comprobante, eventos, acciones legales, hallazgos.

La UI oculta acciones inválidas; Postgres las rechaza igual.

## 11. Rollout

```
8.0 ADR          ← este documento
8.1 Precios      flag off, sale_price intacto, tests del motor
8.2 Core pagos   tablas, stock, cron, RLS; prod solo si verde y apagado
8.3 Transfer     token, bucket, E2E; deploy apagado
8.4 Mercado Pago Preference + webhook + refunds; deploy apagado
8.5 Finanzas     margen/caja/alertas/panel
8.6 Release      reset local, CI, secrets, EF, Vercel, smoke,
                 aviso antes de cobro real, activación atómica
```

Orden de deploy de cada subetapa productiva (cuando corresponda):

1. migración forward-compatible
2. RLS/grants
3. flags en false
4. secrets
5. Edge Functions
6. app Next
7. CI
8. smoke
9. activación atómica (solo 8.6)
10. verificación

Forward-fix: apagar flags; restaurar versión de precios; revocar `EXECUTE` o
desplegar EF que responde 503; no borrar pagos ni eventos; no revertir
migraciones.

## 12. Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Subir `sale_price` in-place | Destructivo, no versionable, ensucia POS y margen |
| Señas / `amount_due` parcial | Cerrado por negocio |
| Meter estados de pago en `orders.status` | Rompe 6.1 y el panel existente |
| Confirmar por `back_urls` | Oficialmente informativo; fraude trivial |
| Webhook en Route Handler Next | Expondría secretos o `service_role` al runtime de Vercel app |
| Reusar bucket `receipts` | Contrato `{auth.uid()}/`; el comprador es anónimo |
| Crear `sales` o `incomes` al cobrar | Duplica 6.6 |
| Reembolso = restore de stock | Mezcla caja con inventario; 6.3 es otra autoridad |
| Checkout API / Bricks | Negocio eligió Checkout Pro |
| Editar `cron.job` | Prohibido; usar `cron.schedule` |

## 13. Pendiente del propietario (no bloquea 8.1–8.3)

1. Access token de prueba / producción de Mercado Pago y Webhook secret.
2. Confirmación en el panel de MP de acreditación a 10 días y de la tasa
   efectiva vigente al momento de 8.6 (la referencia 5,3119 % se usa hasta
   entonces).
3. CBU, alias, banco, titular y CUIT reales para la versión que se active.
4. Aviso explícito antes del primer cobro o reembolso monetario real.
5. Usuarios y tarjetas de prueba para el E2E 8.4 con MP vivo.

8.1 puede empezar: el motor de precios y el dual-price detrás de flag no
requieren credenciales externas.
