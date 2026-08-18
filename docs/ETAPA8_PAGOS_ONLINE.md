# Etapa 8 — Pagos online

Pagos online es una etapa independiente. Ya no forma parte de Stage 6.7.
B2B/mayoristas y multisucursal están fuera del backlog.

**Estado (2026-08-17):** 8.0–8.5 cerrados en código. Capa productiva apagada.
8.6 documenta el encendido; no hay cobros online activos.

ADR vigente: [`ETAPA8_PAYMENT_ADR.md`](./ETAPA8_PAYMENT_ADR.md).
Checklist vivo: [`ETAPA8_PAGOS_RUNBOOK.md`](./ETAPA8_PAGOS_RUNBOOK.md).

## Resultado buscado

Cobrar el **total** de un pedido de catálogo (productos, combos, cupón y
envío) con importes calculados por el servidor y confirmación segura:

1. Mercado Pago — Checkout Pro, precio público.
2. Transferencia bancaria directa — precio base.

No existen señas ni pagos parciales del pedido.

## Decisiones cerradas

- El navegador no decide el importe ni marca un pedido como pagado.
- La confirmación de Mercado Pago proviene de un webhook firmado
  (`x-signature`) más `GET /v1/payments/{id}`. El retorno de checkout es
  informativo.
- Eventos repetidos son idempotentes.
- Los secretos del proveedor viven solo en Edge Functions.
- `sale_price` es el precio base / transferencia. El precio público se deriva
  de una versión de configuración y no se escribe encima del precio de lista.
- Fórmula inicial: `public = ceil((base / (1 - 0.053119)) / 100) * 100`.
  Ejemplo: base $100.000 → público $105.700 → ahorro $5.700.
- El catálogo muestra ambos precios **antes** del checkout cuando el flag
  esté activo. No hay recargo sorpresa al final.
- Reserva de stock al iniciar el pago. MP 30 min; transferencia 24 h.
- Kill switch de la capa, de MP y de transferencia, sin borrar datos.
- Textos públicos humanos. Cero jerga interna.

## Integraciones con etapas anteriores

- Stage 6.1: pedido, snapshots, máquina operativa intacta.
- Stage 6.2: liberar stock puede reabrir alertas.
- Stage 6.3: autoridad de devolución física POS. Un reembolso financiero de
  Stage 8 no restaura stock por sí solo.
- Stage 6.4: margen POS se mantiene; la comisión real de MP se reporta en
  una vista de pagos, no convirtiendo el pedido en venta POS.
- Stage 6.6: no insertar cobros de catálogo en `sales` ni `incomes`.
- Stage 7: el envío entra al total; se le aplica el mismo motor de precios.

## Subetapas

| ID | Alcance | Estado |
|---|---|---|
| 8.0 | Auditoría y ADR | Cerrado (docs) |
| 8.1 | Motor de precios versionado | Cerrado en prod con flags apagados |
| 8.2 | Core de pagos, stock, RLS | Aplicado en prod; cron de Postgres no disponible — corregido en 8.3 |
| 8.3 | Transferencia, capability y expiración Vercel | Cerrado en prod con flags apagados |
| 8.4 | Mercado Pago Checkout Pro | Código y migración en prod; flags y cobros apagados |
| 8.5 | Finanzas, margen, conciliación, panel | Implementado; flags apagados |
| 8.6 | Release productivo atómico | Informe listo; encendido pendiente del dueño |

## Pendiente del propietario (para 8.4 / 8.6)

- Credenciales de prueba y producción de Mercado Pago + secreto de webhook.
- Confirmación de acreditación a 10 días y de la tasa efectiva de la cuenta.
- Datos bancarios reales (CBU, alias, banco, titular, CUIT).
- Aviso antes del primer cobro o reembolso monetario real.
