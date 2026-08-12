# Etapa 1 — Roles y precios (decisión documentada)

**Estado (2026-08-12):** las cuatro migraciones están aplicadas en Supabase
producción; las dos cuentas activas son `admin` y hay cero `vendedor`. La app de
Vercel todavía **no fue desplegada**.
Verificaciones: lint, TypeScript, unit, build y E2E locales; además, matriz de
integración Stage 0 + Stage 1 **25/25** sobre una instancia local restaurada desde
el esquema productivo (sin copiar datos de usuarios).
Passkeys: **deshabilitadas** (`PASSKEYS_CONTAINED = true`; módulo `lib/security/passkeysContainment.ts` es parte del alcance de contención mantenido en Etapa 1).

## Roles

| Rol | Panel | POS / ventas | Inventario escritura | Gastos | Ingresos | Borrar ventas | Asignar roles |
|---|---|---|---|---|---|---|---|
| `admin` | sí | sí | sí | sí | sí | solo RPC | sí (otros) |
| `vendedor` | sí | sí (RPC) | no | sí | no | no | no |
| `none` | no | no | no | no | no | no | no |

Decisión de negocio vigente: no se asignará `vendedor` en el corto ni mediano
plazo. El rol permanece definido para evitar una migración destructiva, pero el
bootstrap productivo será solo para `admin` y la verificación pre/post-deploy debe
confirmar cero asignaciones `vendedor`.

### Fuente de verdad

- Tabla `public.user_roles` (no `user_metadata`).
- Helpers `SECURITY DEFINER` con `search_path = ''`: `current_app_role()`, `is_app_admin()`, `can_use_pos()`, `can_manage_inventory()`, `can_manage_finance()`.
- RLS `user_roles`:
  - `user_roles_select_own` — el usuario lee su fila;
  - `user_roles_select_admin` — admin lee todas (vía `is_app_admin()`, sin recursión).
  - Reafirmadas al **final** de `stage1_rls_by_role` (21412 no las deja borradas).
- `set_user_role`: admin o service_role; **lock** `pg_advisory_xact_lock(87201411)`; protege **último admin**.
- `bootstrap_first_admin(uuid)`: solo service_role; mismo lock; sin autoclaim en login.

### Grants relevantes (authenticated)

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `user_roles` | sí (RLS) | no | no | no |
| `sales` | staff | no | admin (metadatos) | **no** (solo RPC) |
| `sale_items` | staff | no | no | **no** (solo RPC) |
| `stock_movements` | staff | no | no | no |
| `products` | staff | admin | admin | admin |

`service_role` conserva ALL operativo donde se declara.

La migración final de endurecimiento elimina grants heredados peligrosos
(`TRUNCATE`, `TRIGGER`, `REFERENCES`, `MAINTAIN` y mutaciones de `anon`), revoca
ejecución pública de helpers internos y elimina la policy amplia heredada de
actualización de recibos.

`products` mantiene SELECT completo para staff porque el POS y el tablero actuales
consumen la tabla base. Esto incluye campos internos para `vendedor`; si el negocio
requiere ocultar costo/notas a ese rol, hace falta separar una superficie POS de
columnas mínimas y una superficie administrativa. No debe confundirse ocultar la
pantalla Inventario con seguridad de columnas.

### Eliminación de ventas

- **Único camino:** `delete_sale_and_restore_stock` (DEFINER, `is_app_admin`, restaura stock, transaccional).
- La RPC bloquea la fila de `sales` con `FOR UPDATE` antes de leer líneas; dos
  borrados concurrentes no pueden restaurar stock dos veces.
- No hay policy ni GRANT DELETE de `sales`/`sale_items` para `authenticated`.

## Precios (Opción A)

| Contexto | Precio |
|---|---|
| Catálogo web | `sale_price` + `discount_percentage` |
| POS preview UI | `precioListaProducto` / `precioListaCombo` = `round(sale_price)` sin descuento web |
| POS autoridad | RPC `round(sale_price::numeric, 0)` |

### Histórico

- `sale_items.unit_price` / `subtotal` / `discount_percentage` (0) / `product_name` desde catálogo al confirmar.
- Cliente **no** impone total, unit_price, subtotal, product_name ni descuentos.

### Pagos (RPC)

- `status`: `completed` | `pending_payment`.
- `payment_method`: `efectivo` | `tarjeta` | `transferencia` | `mixto` | `credito`.
- Coherencia: `pending_payment` ↔ `credito` (y viceversa).
- `payment_breakdown`:
  - **Ausente** → NULL.
  - **Presente** debe ser array; objeto, string y JSON null → `invalid_payment_breakdown`.
  - Elementos: objetos con method ∈ {efectivo,tarjeta,transferencia} y amount numérico > 0.
  - Array no vacío → suma = total (`payment_mismatch`).
  - `mixto` exige array no vacío (`payment_breakdown_required`).
  - Métodos simples y `credito/pending_payment` no admiten breakdown
    (`payment_breakdown_not_allowed`).

## Passkeys

Contenidas. Diseño v2: `docs/PASSKEYS_V2.md`.

## Migraciones (orden)

1. `20260810221411_stage1_app_roles.sql`
2. `20260810221412_stage1_rls_by_role.sql`
3. `20260810221413_stage1_pos_authoritative_pricing.sql`
4. `20260812002815_stage1_harden_legacy_anon_grants.sql`
