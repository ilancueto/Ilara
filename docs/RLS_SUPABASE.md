# Instrucciones: Row Level Security (RLS) en Supabase

Para que solo los usuarios autenticados accedan a los datos que les corresponden, tenés que revisar y configurar **Row Level Security** en las tablas de tu proyecto Supabase.

## Script unificado (recomendado)

En la raíz del repo está **`supabase_rls_all.sql`**. Ejecutalo en Supabase (SQL Editor → New query → Pegar → Run) para:

- Activar RLS en: `customers`, `products`, `categories`, `sales`, `sale_items`, `expenses`, `stock_movements`, `coupons`, **`combos`**, **`combo_items`**.
- Crear las políticas por tabla (idempotente: hace `DROP POLICY IF EXISTS` antes de cada `CREATE POLICY`).
- Incluye políticas **`anon`** de solo lectura en `products`, `categories`, `combos` y `combo_items` para que **`/catalogo`** funcione sin login (alineadas con las queries del cliente).

Si antes usaste otro script de RLS (p. ej. el que venía en `supabase_stock_movements.sql`), no hay conflicto: el script unificado reemplaza esas políticas.

## Políticas aplicadas por tabla

| Tabla | Política | Comportamiento |
|-------|----------|----------------|
| `customers` | Usuarios autenticados pueden gestionar clientes | `FOR ALL TO authenticated` — todos los logueados comparten la lista (sin `user_id`). |
| `products` | Authenticated + anon catálogo | `FOR ALL TO authenticated`; **`anon` SELECT** solo si el producto es visible en catálogo y `stock >= 0`. |
| `categories` | Authenticated + anon catálogo | `FOR ALL TO authenticated`; **`anon` SELECT** para listar categorías en el catálogo público. |
| `combos` | Anon activos + authenticated | **`anon` SELECT** si `is_active = true`; `authenticated` ALL. |
| `combo_items` | Anon + authenticated | **`anon` SELECT** si el combo padre está activo; `authenticated` ALL. |
| `sales` | Authenticated can manage sales | `FOR ALL TO authenticated`. |
| `sale_items` | Authenticated can manage sale_items | `FOR ALL TO authenticated`. |
| `expenses` | Authenticated can manage expenses | En el script unificado: `FOR ALL TO authenticated` (datos compartidos; `user_id` queda para auditoría en inserts). |
| `stock_movements` | Authenticated can manage stock_movements | `FOR ALL TO authenticated`. |
| `coupons` | Authenticated + anon cupones activos | Script unificado: `authenticated` ALL. Además ejecutar **`supabase_catalog_discounts_and_coupons.sql`** para **`anon` SELECT** de cupones activos en el catálogo. |
| `incomes` | Users can manage own incomes | Definida en **`supabase_incomes.sql`**. Ejecutá ese archivo en el SQL Editor para crear la tabla y sus políticas. |

La app ya envía `user_id` en los INSERT de gastos (`lib/expenseService.ts`); el resto de tablas no usan `user_id`, por eso comparten datos entre todos los autenticados.

## Dónde configurarlo (manual)

1. Entrá a [Supabase Dashboard](https://supabase.com/dashboard).
2. Elegí tu proyecto (Ilara).
3. En el menú izquierdo: **Authentication** → **Policies** o **Table Editor** → elegí la tabla → pestaña **Policies**.

## Tablas cubiertas por el script

Las tablas listadas arriba en “Políticas aplicadas” están cubiertas por `supabase_rls_all.sql`.

## Pasos genéricos para una tabla con `user_id`

1. **Activar RLS en la tabla**
   - Table Editor → tabla → **Settings** (o el ícono de candado).
   - Activá **Enable Row Level Security (RLS)**.

2. **Crear política de lectura**
   - Policies → **New Policy**.
   - Tipo: "For full access" o "For SELECT".
   - Expression (ejemplo para que cada usuario vea solo sus filas):
     ```sql
     auth.uid() = user_id
     ```
   - Guardar.

3. **Crear políticas de escritura (INSERT, UPDATE, DELETE)**
   - Misma idea: solo donde `auth.uid() = user_id` (para INSERT podés usar `auth.uid()` como valor de `user_id`).

## Ejemplo para `expenses`

- **SELECT:** `auth.uid() = user_id`
- **INSERT:** `auth.uid() = user_id` (y en el INSERT desde la app ya estás mandando `user_id` del usuario logueado).
- **UPDATE / DELETE:** `auth.uid() = user_id`

## Recursos oficiales

- [Row Level Security (Supabase)](https://supabase.com/docs/guides/auth/row-level-security)
- [Políticas con Postgres](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

Después de cambiar políticas, probá en la app que el login siga funcionando y que cada usuario solo vea y edite lo que debe.
