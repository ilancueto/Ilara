# Pruebas de integración Etapa 0

## Objetivo

Validar en un entorno **real** (Supabase local o staging), no solo SQL estático:

| Caso | Expectativa |
|---|---|
| `anon` → `sales` / `sale_items` | Error o 0 filas (sin superficie) |
| `anon` → `products.purchase_price` (u otras internas) | Error de privilegio |
| `anon` → columnas públicas + `catalog_sales_by_product` | OK |
| Usuario permitido (authenticated) | Lectura de ventas / panel según RLS actual |
| Usuario no permitido / cross-user Storage | No lee path de otro uid en `receipts` |
| Edge Function passkey | HTTP 403 + `PASSKEYS_DISABLED` |

## Requisitos

### Opción A — Supabase local

1. Docker Desktop instalado y en PATH
2. `supabase start` en la raíz del repo
3. `supabase db reset` (aplica migraciones)
4. Exportar keys de `supabase status -o env`
5. Crear dos usuarios de prueba (ver abajo)

### Opción B — Staging dedicado

Proyecto Supabase **no productivo** con migraciones Etapa 0 ya aplicadas y
usuarios de prueba. **No** usar producción con datos reales de clientes.

## Variables de entorno

```bash
# Obligatorio para correr la suite
STAGE0_INTEGRATION=1
STAGE0_SUPABASE_URL=https://xxxx.supabase.co   # o http://127.0.0.1:54321
STAGE0_ANON_KEY=eyJ...
STAGE0_SERVICE_ROLE_KEY=eyJ...                  # solo staging/local

# Usuarios de prueba (crear en Auth del proyecto de test)
STAGE0_USER_A_EMAIL=stage0-a@example.com
STAGE0_USER_A_PASSWORD=...                      # no commitear
STAGE0_USER_B_EMAIL=stage0-b@example.com
STAGE0_USER_B_PASSWORD=...
```

Nunca copiar estas claves a git ni a `AUDITORIA.md`.

## Comando

```bash
npm run test:integration
```

Sin `STAGE0_INTEGRATION=1` la suite **se omite** (exit 0) para no fallar CI local
sin Docker. En el pipeline de contención debe ejecutarse con las vars seteadas.

## Creación rápida de usuarios (service role, solo staging)

Usar Dashboard → Authentication → Users, o Admin API. No automatizar creación
contra prod.
