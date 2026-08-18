# Runbook — Stage 9 Integración operativa

## Antes de aplicar

1. Validar localmente: `npm run db:reset`, tests, lint, `tsc`, build, advisors y matrices de seguridad.
2. Confirmar que los flags de Stage 8 siguen en `false`.
3. No cobrar ni reembolsar dinero real.

## Migraciones nuevas (forward-only)

| Archivo | Qué hace |
| --- | --- |
| `supabase/migrations/20260818023000_stage91_order_customer.sql` | `orders.customer_id`, vínculo seguro, backfill inequívoco, CRM con pedidos |
| `supabase/migrations/20260818024000_stage92_commercial_margin.sql` | `order_item_components` + `commercial_margin_report` |
| `supabase/migrations/20260818025000_stage93_order_returns.sql` | `order_returns` + `create_order_return` + margen con devoluciones |

No editar migraciones anteriores.

## Aplicar en producción

Sólo después del verde local:

```bash
# desde el repo, proyecto ya vinculado
npx supabase db push
```

Luego `npm run db:types` en local contra la DB actualizada si hubo drift.

Verificación de sólo lectura:

```sql
select count(*) filter (where customer_id is not null) as linked,
       count(*) filter (where customer_id is null) as unlinked
from public.orders;

select count(*) from public.order_customer_link_audit;
select count(*) from public.order_item_components;
select count(*) from public.order_returns;

select payments_enabled, mercado_pago_enabled, bank_transfer_enabled
from public.payment_pricing_versions
where status = 'active';
```

## Rollback forward-only

No hay `git reset --hard` ni `DOWN`. Si hace falta desactivar la operación:

1. Dejar de usar la UI de devoluciones de catálogo.
2. No eliminar columnas: rompería pedidos nuevos.
3. Una migración posterior puede:
   - desactivar el trigger `orders_assign_customer_trg`;
   - revocar `EXECUTE` de `create_order_return` y `commercial_margin_report`;
   - dejar las tablas en su lugar.

Los pedidos y clientes ya vinculados permanecen.

## Flags

No activar pagos. Stage 9 no cambia versiones de precio.

## Copy

Textos visibles: “Venta en local”, “Pedido online”, “Costo no disponible”. Nunca RPC, webhook, cron, token, provider, flags o sandbox.
