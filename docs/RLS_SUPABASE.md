# Instrucciones: Row Level Security (RLS) en Supabase

Para que solo los usuarios autenticados accedan a los datos que les corresponden, tenés que revisar y configurar **Row Level Security** en las tablas de tu proyecto Supabase.

## Dónde configurarlo

1. Entrá a [Supabase Dashboard](https://supabase.com/dashboard).
2. Elegí tu proyecto (Ilara).
3. En el menú izquierdo: **Authentication** → **Policies** o **Table Editor** → elegí la tabla → pestaña **Policies**.

## Tablas a revisar

Según el código de la app, estas tablas deberían tener RLS y políticas que restrinjan por usuario cuando aplique:

| Tabla | Uso en la app | Qué revisar |
|-------|----------------|-------------|
| `expenses` | Gastos (usa `user_id`) | Solo el usuario dueño puede ver/crear/editar/borrar sus filas. |
| `easter_claims` | Easter egg (por `device_id`, no usuario) | Podés dejar acceso público de lectura/inserción controlada por API, o restringir si querés. |
| `coupons` | Cupones | Inserción solo desde el backend (API con service role). Lectura para validar en el catálogo. |
| `sales` | Ventas | Si hay `user_id` o equivalente, solo ese usuario. Si es multi-tenant, políticas por tenant. |
| `products`, `categories` | Catálogo e inventario | Si solo usuarios logueados editan, políticas de escritura para `authenticated`; lectura puede ser pública para catálogo. |

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
