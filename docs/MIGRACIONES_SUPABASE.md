# Una sola fuente de verdad para cambios de esquema (A5 / Stage 2)

## Regla

- **Nuevos cambios:** solo como archivos en **`supabase/migrations/`** creados con
  la CLI: `npx supabase migration new <nombre_descriptivo>`.
- **Scripts históricos** en `supabase/sql/` son **referencia archivada**. No se
  ejecutan en CI ni en `db reset`. Ver `supabase/sql/README.md`.
- **Baseline** `20250101000000_baseline_core_schema.sql`: bootstrap de aplicación
  para bases vacías / local. En producción esa versión ya figura aplicada; no se
  re-ejecuta al expandir el archivo en git.
- No modificar migraciones ya aplicadas en producción. Solo forward-only.

## Orden de aplicación (proyecto desde cero)

1. `supabase start` (stack completo requerido por las pruebas de Auth/Data API)
2. Migraciones en orden cronológico (incluye baseline, Stage 0, Stage 1, Stage 2)
3. Seed ficticio opcional (`supabase/seed.sql`)
4. Tipos: `npm run db:types`
5. Checks: `npm run test:db-rls`, `npm run test:db-security`, advisors

## Comandos de gobierno

| Comando | Uso |
|---|---|
| `npx supabase migration list --local` / `--linked` | Evidencia local vs remoto |
| `npx supabase db reset --local` | Reconstrucción limpia |
| `npx supabase db dump --local --schema public -f …` | Dump estructural local |
| `npx supabase db dump --linked --schema public -f …` | Dump estructural prod (solo lectura) |
| `npx supabase db diff --from local --to linked --schema public` | Diff sanitizar a mano |
| `npx supabase db advisors --local --type security` | Advisors |

## Equipo

- Quien mergea a `main` con migración nueva debe coordinar apply en producción
  (`db push` o SQL revisado) tras backup.
- Runbook Stage 2: [`docs/ETAPA2_RUNBOOK.md`](./ETAPA2_RUNBOOK.md).
