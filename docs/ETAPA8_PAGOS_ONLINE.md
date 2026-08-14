# Etapa 8 — Pagos online

Pagos online es una etapa independiente del producto. Ya no forma parte de
Stage 6.7. Las propuestas de B2B/mayoristas y multisucursal fueron descartadas
por decisión de negocio y no integran el backlog vigente.

## Resultado buscado

Cobrar una seña o el total de un pedido online con importes calculados por el
servidor y confirmación segura del proveedor.

## Reglas no negociables

- El navegador no decide el importe ni marca un pedido como pagado.
- La confirmación proviene de un webhook firmado y verificado.
- Eventos repetidos deben ser idempotentes.
- Un retorno exitoso del checkout es informativo, no prueba de pago.
- Los secretos del proveedor permanecen únicamente en backend.
- Cada cambio de estado queda auditado.

## Integraciones con etapas anteriores

- Stage 6.1: pedido e importe autoritativo.
- Stage 6.2: liberación de stock puede reabrir alertas.
- Stage 6.3: reembolsos y notas de crédito.
- Stage 6.4: comisión del proveedor y margen.
- Stage 6.6: conciliación y saldos.

El proveedor, checkout, política de reserva y reglas de reembolso se definirán
antes de implementar. Mercado Pago es un candidato, no una elección confirmada.
