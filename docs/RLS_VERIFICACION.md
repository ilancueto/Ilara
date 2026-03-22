# Cómo verificar RLS (A2)

## En Supabase Dashboard

1. **Authentication → Policies** (o **Table Editor** → tabla → **RLS**).
2. Comparar con el repo:
   - `supabase_rls_all.sql` — políticas base de tablas de negocio.
   - Migraciones en `supabase/migrations/` — cambios incrementales.

## Comprobaciones útiles

| Tabla / recurso | Anon | Authenticated |
|-----------------|------|----------------|
| `products` | SELECT solo catálogo (visible + stock ≥ 0) | ALL |
| `categories` | SELECT | ALL |
| `combos` / `combo_items` | SELECT combos activos | ALL |
| `coupons` | SELECT activos (cupón catálogo) | ALL |
| `sale_items` | Sin SELECT directo para agregados | ALL |
| **RPC** `catalog_sales_by_product` | EXECUTE (totales agregados) | EXECUTE |

## Si algo “no guarda” o “no lee”

- Revisá que el usuario esté **authenticated** en el cliente (cookies / sesión).
- Revisá que la política `WITH CHECK` permita los valores que insertás (p. ej. `user_id`).
