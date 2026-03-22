# Observabilidad opcional — Sentry (D)

La app ya usa **Vercel Analytics** y **Speed Insights** desde `app/layout.tsx`.

Para capturar **errores de cliente y servidor** con [Sentry](https://sentry.io):

1. Crear proyecto Next.js en Sentry y obtener el **DSN**.
2. `npm install @sentry/nextjs`
3. Ejecutar `npx @sentry/wizard@latest -i nextjs` en el repo (ajusta `next.config` y crea `sentry.*.config.ts`).
4. Añadir `NEXT_PUBLIC_SENTRY_DSN` en Vercel (y opcionalmente `SENTRY_AUTH_TOKEN` en CI para source maps).

**Nota:** El wizard envuelve `next.config`; si choca con Serwist o el analyzer, revisá el orden de los `with*` o usá la [config manual](https://docs.sentry.io/platforms/javascript/guides/nextjs/).

Sin DSN, la app funciona igual; no es obligatorio para desarrollo local.
