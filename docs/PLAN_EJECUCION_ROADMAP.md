# Plan de ejecución – Ilara (en curso)

Alineado con [`ROADMAP_INMEDIATO.md`](./ROADMAP_INMEDIATO.md). **Roles por empleado / auditoría multi-usuario:** no aplica en el corto/mediano plazo (un solo operador).

**Última actualización:** 2026-03-21

---

## Decisiones tomadas (arranque)

| # | Decisión |
|---|----------|
| D1 | **E2E:** prioridad flujos que no dependan de Supabase de test (login/venta real = opcional después). |
| D2 | **RLS catálogo:** script aplicado en Supabase; políticas **`anon`** + `authenticated` según `supabase_rls_all.sql`. |
| D3 | **Orden:** tests unitarios de lógica crítica **antes** de ampliar E2E. |

---

## Qué estamos haciendo (orden)

1. ~~**RLS + docs**~~ — `supabase_rls_all.sql` ampliado; `docs/SECURITY_PENTEST.md`, `docs/RLS_SUPABASE.md` actualizados.
2. ~~**Tests precios/cupón**~~ — `lib/catalogPricing.ts` + Vitest; `Catalogo.tsx` usa esas funciones.
3. ~~**Refactor carga de datos**~~ — `hooks/useCatalogData.ts`; `Catalogo.tsx` más liviano en esa parte.
4. ~~**Supabase:**~~ aplicado (`supabase_rls_all.sql`).
5. ~~**Checklists manuales:**~~ completados — [`CHECKLIST_PENTEST_MANUAL.md`](./CHECKLIST_PENTEST_MANUAL.md) (ítem 5 Postman pendiente opcional), [`CHECKLIST_EXPORTACIONES.md`](./CHECKLIST_EXPORTACIONES.md) (todo OK).
6. **Dependencias:** ver [`NOTA_DEPENDENCIAS_BUILD.md`](./NOTA_DEPENDENCIAS_BUILD.md) y aplicar `npm audit fix` cuando quieras.
7. **E2E:** ampliar pruebas de humo en `e2e/` (catálogo, búsqueda, etc.).
8. **Refactor restante:** seguir partiendo `Catalogo.tsx` / `app/page.tsx` en hooks sin cambiar comportamiento.

---

## Qué necesitamos de vos

| Necesidad | Detalle |
|-----------|---------|
| **Hecho** | SQL RLS en Supabase + checklists exportaciones y pentest (salvo prueba Postman opcional). |
| **Opcional** | Proyecto Supabase de staging + usuario test para E2E con login; prueba **#5** del pentest con `curl`/Postman cuando quieras cerrar al 100%. |

No hace falta que nos pases claves: con la anon key pública la app ya funciona; el SQL lo corrés vos en el dashboard.

---

## Registro rápido

| Ítem | Estado |
|------|--------|
| SQL RLS en repo | Hecho |
| SQL aplicado en Supabase prod | Hecho |
| Tests unitarios catalogPricing | Hecho |
| useCatalogData | Hecho |
| Checklists pentest + exportaciones | Hecho (Postman #5 opcional) |
| Nota npm audit | Actualizado: queda 1 moderate en Next → upgrade 16.2.x cuando puedas |
| E2E extendidos | En progreso / siguiente paso |
