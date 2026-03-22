# B — Dependencias, Serwist y CSP

## B1 — `npm audit`

- Corré **`npm audit`** antes de releases.
- **`npm audit fix`** aplica parches compatibles; si quedan avisos en cadenas de **build** (PWA/workbox), el riesgo es principalmente en CI, no en usuarios finales.
- Revisá el reporte tras cada upgrade mayor de **Next** o **Serwist**.

## B2 — Serwist / PWA

- Seguí [issues de Serwist + Turbopack](https://github.com/serwist/serwist/issues/54) si usás `next dev --turbopack`.
- En desarrollo podés usar `SERWIST_SUPPRESS_TURBOPACK_WARNING=1` (ver README).

## B3 — CSP

- La CSP activa está en `next.config.ts`. Endurecerla (quitar `unsafe-inline` / `unsafe-eval`) requiere **probar en staging** con Supabase, fuentes y scripts reales.
- Opcional futuro: `Content-Security-Policy-Report-Only` para detectar roturas sin bloquear.

## B4 — Passkeys (Edge Function)

- Rate limits y validación de origen están en `supabase/functions/passkey-auth/index.ts`.
- Tras cambios de dominio, actualizar **RP ID** y orígenes permitidos en la función y en WebAuthn.
