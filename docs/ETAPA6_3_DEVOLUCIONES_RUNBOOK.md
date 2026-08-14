# Etapa 6.3 — Devoluciones y notas de crédito

- **Estado:** implementado y validado localmente; pendiente de release productivo.
- **Alcance:** ventas POS, notas de crédito, reintegro de stock y auditoría.
- **Fuera de alcance:** devolución del proveedor, gateway de pagos, factura fiscal
  electrónica y logística de retorno (Stage 7).

## 1. Invariantes

- La venta y sus líneas originales no se editan ni eliminan al devolver.
- Cada devolución genera una nota de crédito inmutable `NC-000000`.
- El importe se calcula en PostgreSQL desde el subtotal histórico de cada línea.
- La suma devuelta nunca supera cantidad ni subtotal originales.
- Un mismo `idempotency_key` no duplica nota, crédito ni stock.
- Las operaciones de una venta se serializan con advisory lock.
- Una venta con devoluciones no puede pasar por el RPC legacy de borrado.

## 2. Modelo

- `sale_returns`: cabecera, venta, motivo, método, total, stock, actor y clave.
- `sale_return_items`: líneas y montos históricos.
- `sale_return_events`: evidencia de creación.
- `sale_item_components`: snapshot de productos físicos por línea.

La migración es `20260814010417_stage63_sales_returns.sql`.

## 3. Combos

Las ventas nuevas capturan la composición del combo al insertar `sale_items`.
Por eso un cambio posterior del combo no altera el stock que se devuelve.

Para ventas anteriores al stage:

- producto directo: snapshot exacto (`legacy_product`);
- combo: backfill desde composición vigente al migrar
  (`legacy_current_combo`), conservando la procedencia para auditoría.

Una línea histórica que no conserve `product_id` ni `combo_id` no permite
reconstruir stock con certeza. La nota puede emitirse con `restock=false`; cualquier
ajuste físico posterior debe registrarse manualmente y quedar auditado.

## 4. Autorización

- Tablas expuestas con RLS.
- SELECT sólo para `is_app_admin()`.
- Sin escrituras directas para `authenticated`.
- `create_sale_return(jsonb)` es `SECURITY DEFINER`, `search_path=''`,
  valida `auth.uid()` + admin y tiene grants explícitos.
- `anon` no puede leer tablas ni ejecutar la RPC.

## 5. Formas de reintegro

- efectivo
- transferencia
- tarjeta
- Mercado Pago
- otro
- cancelación de saldo a crédito (sólo venta `pending_payment`)

El stage registra la obligación/reversión operativa. No ejecuta una devolución
automática contra bancos o pasarelas.

## 6. Stock

Si `restock=true`, la RPC:

1. agrega componentes snapshot × cantidad devuelta;
2. incrementa `products.stock`;
3. registra `stock_movements.type='adjustment'`;
4. permite que el trigger de Stage 6.2 resincronice alertas.

Si el producto no vuelve en condición vendible, el administrador puede desmarcar
el reintegro sin afectar la nota de crédito.

## 7. Validación local

| Check | Resultado |
|---|---|
| `supabase db reset --local` | OK |
| tipos generados / drift | OK |
| RLS 25 tablas | OK |
| matriz anon/service | OK |
| advisors seguridad | 0 issues |
| unitarios | 123/123 |
| integración Stage 6.3 | 10/10 |
| E2E devolución parcial + axe | 1/1 |
| lint / TypeScript | OK |

La integración cubre parcial, idempotencia, sobredevolución, concurrencia,
crédito, combo mutable, no-admin, escritura directa y bloqueo de borrado.

## 8. Rollback / forward-fix

- Ocultar la pestaña no modifica documentos.
- Ante incidente: revocar EXECUTE de `create_sale_return`.
- No borrar notas ni reescribir la migración una vez publicada.
- Correcciones de datos deben ser nuevas operaciones compensatorias auditables,
  no UPDATE/DELETE de documentos históricos.

## 9. Gate productivo

- [ ] Commit y push
- [ ] CI remoto verde
- [ ] Migración productiva
- [ ] Vercel READY
- [ ] Smoke productivo sin residuos
- [ ] Documentación de cierre
