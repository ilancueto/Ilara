# Una sola fuente de verdad para cambios de esquema (A5)

## Regla

- **Nuevos cambios:** solo como archivos en **`supabase/migrations/`** con prefijo de fecha/hora `YYYYMMDDHHMMSS_nombre_descriptivo.sql`.
- **Scripts históricos** en la raíz (`supabase_rls_all.sql`, `supabase_combos.sql`, etc.) son **referencia** o aplicación inicial en proyectos viejos; no dupliques lógica: si tocás RLS o tablas, preferí una **nueva migración** que haga `DROP POLICY IF EXISTS` / `CREATE` idempotente.

## Orden de aplicación sugerido (proyecto desde cero)

1. Esquema base (productos, ventas, clientes…) según scripts del repo o dump.
2. `supabase_rls_all.sql` (o equivalente) para RLS.
3. Migraciones en `supabase/migrations/` **en orden cronológico por nombre de archivo**.

## Equipo

- Quien mergea a `main` con migración nueva debe **avisar** que hay que correr SQL en producción o automatizar con Supabase CLI / GitHub Actions.
