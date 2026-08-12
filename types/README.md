# Tipos generados desde Postgres

- **Canónico:** `database.generated.ts` (`export type Database = …`)
- **Regenerar:** `npm run db:types` (requiere Supabase local en marcha)
- **CI:** `npm run db:types:check` falla si hay drift

Los tipos de dominio en `lib/supabase.ts` y `lib/types.ts` son capa de UI y
pueden divergir en nombres en español. No editar a mano el archivo generado.
