# Etapa 8 — Informe de cierre (sin cobros)

**Fecha:** 2026-08-17  
**Proyecto Supabase:** `qbbnvdmadgomfmrsfxlo`  
**Sitio:** https://ilara.com.ar  
**Decisión de este cierre:** la capa está desplegada y **apagada**. No se cobra, no se reembolsa dinero real y no se encienden flags hasta revisión del dueño.

## Subetapas

| ID | Commit principal | Migración prod | Estado |
|---|---|---|---|
| 8.0 | `ed9c280` | n/a | Cerrado |
| 8.1 | `19d0cea` | `20260817222422` | Cerrado, flags off |
| 8.2 | `ed76100` | `20260817225016` | Cerrado; pg_cron ausente |
| 8.3 | `d6084c8` | `20260817231453` | Cerrado; cron Vercel + capability |
| 8.4 | `1a0c8a2` | `20260818003000` | Código y SQL en prod; EFs pendientes de secreto webhook |
| 8.5 | `531aec8` | `20260818014000` | Corte de caja + hallazgos |
| 8.6 | este informe | — | Verificación y procedimiento de encendido, **sin activar** |

## Flags (obligatorio: todos false)

- `payments_enabled = false`
- `mercado_pago_enabled = false`
- `bank_transfer_enabled = false`
- `catalog_dual_price_visible = false`

No hay filas en `order_payments` de producción al momento del cierre 8.4. 8.5 no crea cobros.

## Qué quedó construido

- Precio público versionado. `sale_price` no se pisa.
- Pedido de catálogo con clave de seguimiento (hash en BD).
- Transferencia con comprobante privado y revisión admin.
- Mercado Pago: Preference, webhook firmado + GET canónico, reembolso. El retorno no confirma.
- Expiración cada 5 minutos por Vercel Cron + `service_role`.
- Corte financiero de pedidos **aparte** del mostrador (6.6 intacto). No se inserta en `sales` ni `incomes`.

## Encendido atómico (solo después de tu revisión)

No ejecutar hasta que el dueño lo pida por escrito.

1. Datos bancarios reales cargados y versión activada.
2. Secreto de webhook de Mercado Pago cargado en Edge Functions.
3. Functions desplegadas: `payments-mp-preference`, `payments-mp-webhook`, `payments-mp-refund`.
4. URL de notificación cargada en Tus integraciones.
5. Smoke de catálogo y `/pedido` en verde.
6. Crear un **borrador** de `payment_pricing_versions` con los cuatro flags en `true` (o los que se quieran).
7. Activar esa versión. Eso enciende la capa de una vez.
8. Probar un cobro de prueba acordado. No hay marcha atrás silenciosa: se apaga con otra versión con flags en `false`.

## Pendiente del dueño

- Secreto de webhook de Mercado Pago.
- Confirmar token de prueba vs producción y tasa/acreditación a 10 días.
- CBU, alias, banco, titular, CUIT e indicaciones reales.
- Aviso explícito antes del primer cobro o reembolso monetario.

## Cómo apagar

Guardar y activar una versión nueva con los cuatro flags en `false`. Los pedidos y pagos ya creados no se borran.
