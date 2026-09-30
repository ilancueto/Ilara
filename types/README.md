# Tipos generados desde Postgres

- **Canónico:** `database.generated.ts` (`export type Database = …`)
- **Regenerar:** `node --env-file=.env.test.local scripts/gen-db-types.mjs` (staging en Supabase en la nube)
- **CI:** `npm run db:types:check` falla si hay drift

Configurar staging siguiendo `docs/SUPABASE_CLOUD_TESTS.md`. No utiliza Docker.

El 30/09/2026 se regeneró el archivo mediante el conector de Supabase desde
producción, en una operación de sólo lectura. La nullabilidad y los campos
obligatorios del esquema real difieren del archivo anterior. TypeScript aprobó
la actualización; el drift contra un staging reconstruido sigue pendiente por
el límite de proyectos gratuitos de la cuenta.

Los tipos de dominio en `lib/supabase.ts` y `lib/types.ts` son capa de UI y
pueden divergir en nombres en español. No editar a mano el archivo generado.
