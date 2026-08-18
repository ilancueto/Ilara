# ADR — Stage 9 Integración operativa

Fecha: 2026-08-18  
Estado: aceptado  
Relacionado: Stages 1, 6.1–6.6, 7 y 8

## Contexto

POS y catálogo ya compartían inventario, pero no clientes, margen comercial ni devoluciones. Los pedidos guardaban nombre y teléfono como texto. El margen 6.4 cubría sólo ventas de mostrador. Las notas de crédito 6.3 cubrían sólo `sales`.

## Decisión

1. **Canales distintos.** Un pedido web no se inserta en `sales` ni su cobro en `incomes`. La caja del local y los cobros online no son el mismo registro.
2. **Cliente único.** `orders.customer_id` (nullable) apunta a `customers`. El alta de pedido busca por teléfono normalizado; si hay un único match lo asocia; si no hay, crea; si hay varios, no asocia. Los snapshots del pedido no se reescriben.
3. **Margen consolidado.** `sales_margin_report` (6.4) sigue siendo la autoridad POS. `commercial_margin_report` agrega POS, catálogo y combinado. El costo de catálogo se snapshotéa al insertar la línea. Sin snapshot, el margen queda nulo (“costo no disponible”).
4. **Devoluciones por canal.** `sale_returns` permanece exclusivo de POS. `order_returns` es el modelo de pedidos online. Reintegro de stock una sola vez. El dinero no se mueve salvo acción explícita; Mercado Pago reutiliza el flujo existente sólo si se pide.
5. **UI.** No hay sección nueva. Pedidos es el centro online. Precios y pagos es sólo configuración. Cuentas y caja, Margen real, Clientes y Devoluciones muestran ambos orígenes con copy humano.

## Consecuencias

- Pedidos históricos pueden quedar sin `customer_id` (teléfono ambiguo o inexistente). Quedan auditados.
- Pedidos anteriores no tienen costo histórico: el margen de catálogo puede quedar incompleto hasta que se revisen.
- Flags de Stage 8 permanecen apagados. Cero cobros reales.

## Rollback

Forward-only. Ver `docs/ETAPA9_RUNBOOK.md`.
