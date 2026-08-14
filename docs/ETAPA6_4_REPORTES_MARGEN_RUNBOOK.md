# Stage 6.4 — Reportes de margen real

## Objetivo y criterio contable

El reporte muestra margen bruto operativo de ventas POS: ingreso neto menos costo
de mercadería vendida. Incluye descuentos y devoluciones; excluye ventas
`pending_payment`. El período se define por fecha de venta en
`America/Argentina/Buenos_Aires` y admite hasta 730 días.

No es un estado contable integral: no incorpora gastos operativos, impuestos,
comisiones de cobro ni costo logístico.

## Veracidad del costo

- Desde esta migración, cada componente físico guarda `unit_cost` al momento de
  vender (`cost_source = sale_time`). Cambiar luego el precio de compra no altera
  el margen histórico.
- Los snapshots anteriores toman el costo vigente al migrar y se identifican
  como `legacy_current` (estimado).
- Un costo desconocido permanece `NULL` y se identifica como `missing`. Nunca se
  convierte implícitamente en cero.
- Si una línea neta carece de costo, su margen y el margen total se devuelven
  como `NULL`. La UI muestra cobertura, líneas exactas, estimadas y faltantes.
- Una devolución resta ingreso por el reintegro registrado y costo según unidades
  devueltas. Una devolución total deja cantidad y costo netos en cero.

## Seguridad

`sales_margin_report(date,date)` es `SECURITY DEFINER`, fija `search_path`, exige
sesión y `is_app_admin()`. `anon` y `PUBLIC` no tienen `EXECUTE`; sólo
`authenticated`, con autorización interna. Los costos sensibles no se exponen
por nuevas tablas ni al catálogo público.

## Operación

El panel está en **Negocio → Margen real** y es visible sólo para admin. Períodos:
mes actual, 30, 90 y 365 días. Incluye KPIs, calidad del dato, serie diaria y los
30 artículos con mayor venta neta.

Para corregir un costo faltante de una venta ya emitida debe hacerse una
corrección controlada en `sale_item_components`, conservando evidencia del valor
y origen. No modificar costos históricos en masa desde la UI.

## Migración y recuperación

Migración: `20260814020513_stage64_margin_reports.sql`.

Es forward-only. Ante un fallo después de publicar:

1. retirar temporalmente el acceso UI a `margin_reports`;
2. revocar `EXECUTE` de `sales_margin_report` a `authenticated` si el riesgo es
   de confidencialidad;
3. corregir mediante una migración nueva que reemplace función/trigger;
4. no eliminar `unit_cost` ni `cost_source`, porque contienen historia de ventas.

## Validación local de cierre

- reconstrucción completa: `supabase db reset --local`;
- integración Stage 6.4: 5/5 (roles, rango, costo congelado, devolución parcial,
  combo, pendiente y costo faltante);
- unitarios globales: 127/127;
- RLS: 25/25 tablas; matriz anon/service verde;
- Supabase security advisors: sin hallazgos `warn`;
- lint, TypeScript, tipos DB y build Next.js 16.3 verdes;
- Playwright Stage 6.4: 1/1, sin violaciones críticas axe.

## Cierre productivo

Pendiente de completar en esta misma etapa: commit/push, CI remoto, migración
Supabase productiva, deployment Vercel `ilara` y smoke productivo.
