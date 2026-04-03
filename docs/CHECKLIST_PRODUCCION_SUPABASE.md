# Checklist producción — migraciones y DB (A1)

## Qué hacer al desplegar código nuevo

1. **Abrir** Supabase → **SQL Editor**.
2. **Ejecutar en orden** los archivos de `supabase/migrations/` por **timestamp** (nombre `YYYYMMDDHHMMSS_*.sql`), del más viejo al más nuevo.
3. Si nunca corriste los scripts manuales en `supabase/sql/` (`supabase_rls_all.sql`, `supabase_combos.sql`, etc.), revisá `docs/MIGRACIONES_SUPABASE.md` y aplicá lo que falte **una sola vez** antes o después de las migraciones, según dependencias.

## Verificación rápida

- **Tablas nuevas:** `catalog_badge` en `products` (migración badges).
- **RPC catálogo:** después de `20260313210000_...`, en SQL Editor:
  ```sql
  select * from public.catalog_sales_by_product() limit 5;
  ```
  Debe listar `product_id` y `units_sold` sin error.

## Entornos

- **Local:** `supabase db push` si usás CLI linkeado al proyecto.
- **Producción:** mismo SQL pegado en el Editor o migraciones desde CI si las tenés conectadas.
