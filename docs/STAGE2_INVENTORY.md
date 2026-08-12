# Stage 2 — Inventario sanitizado de esquema

Fecha de corte: 2026-08-12. Sin datos personales ni secretos.

## Fuentes

| Fuente | Rol |
|---|---|
| `supabase/migrations/` | Cadena versionada (reproducible + Stage 0/1/2) |
| `supabase/sql/` | Histórico manual (obsoleto como fuente de verdad) |
| Backup estructural pre-Stage1 | Evidencia local sensible — **no versionar** |
| Proyecto `qbbnvdmadgomfmrsfxlo` | Producción (solo lectura en Stage 2) |

## Tablas de aplicación

| Tabla | Origen histórico | Clasificación | Notas |
|---|---|---|---|
| `categories` | baseline / prod | reproducible funcional | serial local vs bigint prod (residual estructural) |
| `products` | baseline + migraciones columnas | reproducible | grants columna Stage 0 |
| `sales` | baseline + payment cols | reproducible | cerrado a anon Stage 0/1 |
| `sale_items` | baseline (product_name/subtotal) | reproducible | combo_id en migraciones |
| `combos` / `combo_items` | sql + baseline | reproducible | |
| `expenses` | sql + baseline | reproducible | |
| `customers` | sql manual → baseline Stage 2 | drift→reproducible | email/phone en baseline |
| `incomes` | sql manual → baseline Stage 2 | drift→reproducible | rompía `db reset` |
| `stock_movements` | sql manual → baseline Stage 2 | drift→reproducible | usado por RPC ventas |
| `coupons` | sql manual → baseline Stage 2 | reproducible | SELECT anon activos |
| `user_roles` | Stage 1 | reproducible | |
| `passkey_*` (4) | sql manual → baseline | reproducible contenida | sin superficie app |

## Funciones / RPC (app)

| Función | Clasificación |
|---|---|
| `create_sale_with_items` | reproducible (Stage 1 autoritativo) |
| `delete_sale_and_restore_stock` | reproducible (Stage 1) |
| `catalog_sales_by_product` | reproducible (Stage 0 harden) |
| `dashboard_finance_kpis` / `dashboard_sales_*` | reproducible |
| `current_app_role` / `is_app_admin` / `can_use_pos` / … | Stage 1 |
| `set_user_role` / `bootstrap_first_admin` | Stage 1 |
| `stage0_inventory_legacy_receipt_urls` | Stage 0; solo service_role |
| `check_passkey_*` / `cleanup_*` / `log_passkey_*` | histórico; grants cerrados |
| `update_updated_at_column` / `update_stock_on_sale` | baseline + Stage 1 search_path |

## Storage

| Objeto | Clasificación |
|---|---|
| bucket `receipts` | reproducible (Stage 0 private) |
| policies `receipts_authenticated_*` | reproducible |
| policy legacy `Users can update receipts` | eliminada Stage 1 harden |
| schemas `storage` / roles S3 | **administrado por Supabase** |

## Esquemas no versionables (plataforma)

`auth`, `storage` (core), `realtime`, `extensions`, `supabase_functions`, roles
`anon`/`authenticated`/`service_role` — administrados por la imagen local /
proyecto hosted.

## Solo en scripts históricos (no en cadena previa a Stage 2)

- Creación de `incomes`, `stock_movements`, `customers`, `coupons`, passkeys
- RLS amplio “Authenticated can manage *”
- Policy anon de cupones (recreada en baseline; Stage 1 reafirma grants)

## Solo en producción (drift residual post-local)

- Tipos `bigint` + `nextval` en PKs core (local usa `serial`/`integer`):
  compatibilidad funcional, pero no paridad estructural completa
- `DEFAULT PRIVILEGES` más amplios hacia `anon`/`authenticated` (legacy)
- Índices Stage 2 hasta aplicar forward-only en remoto
- Posibles policies passkey legacy hasta aplicar Stage 2
- Datos, estadísticas, índices “unused” no comparables

## Objetos duplicados / contradictorios

| Tema | Resolución Stage 2 |
|---|---|
| `line_total` vs `subtotal` en sale_items | baseline usa `subtotal` (RPC) |
| Policies panel amplias vs Stage 1 roles | Stage 0/1 ganan; baseline solo bootstrap |
| Passkeys “habilitadas” en sql vs 403 app | tablas versionadas; grants/policies cerrados |
| `supabase/sql` vs migrations | sql archivado documentalmente |
