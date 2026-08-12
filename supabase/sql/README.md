# Scripts SQL históricos (archivados)

**Estado:** histórico / obsoleto como fuente de verdad.
**No aplicar en producción** salvo investigación forense o comparación.

## Rol en Stage 2

Hasta Stage 1, parte del esquema productivo se creó con estos scripts
manuales (SQL Editor), fuera de `supabase/migrations/`. Eso generó drift:
un `supabase db reset` desde migraciones incompletas fallaba (p. ej. al
crear RPC que referencian `public.incomes`).

Desde Stage 2:

| Ubicación | Rol |
|---|---|
| `supabase/migrations/` | **Única** fuente de verdad para cambios de esquema |
| `supabase/sql/*.sql` | Evidencia histórica; no se ejecutan en CI ni en reset |
| Baseline `20250101000000_…` | Bootstrap de aplicación para bases vacías |

## Inventario resumido

| Archivo | Objetos principales | Clasificación |
|---|---|---|
| `supabase_incomes.sql` | tabla `incomes` + RLS amplio | absorbido en baseline |
| `supabase_stock_movements.sql` | tabla `stock_movements` + RLS | absorbido en baseline |
| `supabase_combos.sql` | combos / combo_items | absorbido + migraciones |
| `supabase_expenses_setup.sql` | expenses + bucket receipts | absorbido + Stage 0 storage |
| `supabase_rls_all.sql` | policies legacy panel/catálogo | reemplazado Stage 0/1 |
| `supabase_passkey_auth.sql` | tablas/funciones passkey | absorbido en baseline; app 403 |
| `supabase_catalog_discounts_and_coupons.sql` | coupons + discount | absorbido / Stage 1 RLS |
| `supabase_customers_email_phone.sql` | columnas customers | absorbido en baseline |
| `supabase_audit_columns.sql` | created_by / updated_by | absorbido en baseline |
| `supabase_add_receipt_url_to_sales.sql` | sales.receipt_url | absorbido |
| `supabase_sales_payment_*.sql` | payment_method / breakdown | absorbido + Stage 1 RPC |
| `diagnostico_stock_triggers.sql` | solo diagnóstico | no schema |

## Regla

Cualquier cambio nuevo → `npx supabase migration new <nombre>` y revisión.
No copiar estos scripts a producción.
