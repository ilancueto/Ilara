# Login por biometría (Passkeys)

Permite iniciar sesión con huella dactilar, Face ID, Windows Hello, etc. usando **supakeys**.

## Requisitos

- HTTPS (o `localhost` en desarrollo)
- Navegador con soporte WebAuthn (Chrome, Safari, Edge, Firefox)

## Paso 1: Migración en Supabase

Ejecutá el SQL en **Supabase → SQL Editor**:

**Archivo:** `supabase_passkey_auth.sql` (en la raíz del repo)

Ese script crea las tablas `passkey_credentials`, `passkey_challenges`, `passkey_rate_limits`, `passkey_audit_log` y las funciones necesarias.

## Paso 2: Edge Function

Tenés que crear y desplegar la Edge Function `passkey-auth`. **Debe tener JWT desactivado** (la función maneja auth internamente). Hay dos formas:

### Opción A: Con Supabase CLI

```bash
npx supakeys init
```

Cuando pregunte:
- Crear directorio supabase? **Y**
- Relying Party ID: **localhost** (dev) o tu dominio en producción
- Application name: **Ilara**

Luego (el config.toml ya tiene `verify_jwt = false`):

```bash
supabase functions deploy passkey-auth
```

Si desplegás desde el Dashboard, **desactivá "Verify JWT"** en la función.

### Opción B: Desde el Dashboard

1. En Supabase → **Edge Functions** → **Create a new function** → **Deploy via Editor**
2. Nombre: `passkey-auth`
3. **Importante:** desactivá "Verify JWT" (o "Enforce JWT") — la función valida auth internamente
4. Copiá el contenido de `supabase/functions/passkey-auth/index.ts` y pegálo en el editor
5. Hacé clic en **Deploy**

## Paso 3: Configuración

La app usa:
- **rpId:** `localhost` en dev, o el hostname actual en producción
- **rpName:** Ilara

Si desplegás en un dominio (ej. `ilara.vercel.app`), el rpId debe coincidir. En `lib/passkeyAuth.ts` se usa `window.location.hostname`.

## Uso

1. **Primera vez:** iniciá sesión con email y contraseña
2. **Agregar passkey:** después del login, hacé clic en "Agregar huella / Face ID" (o similar)
3. **Próximos inicios:** en el login, ingresá tu email y usá "Iniciar con huella / Face ID"
