# Observabilidad opcional — Sentry (histórico + Stage 4)

La app ya usa **Vercel Analytics** y **Speed Insights** desde `app/layout.tsx`.

**Stage 4 (2026-08-12):** hay una capa propia de observabilidad segura
(`lib/observability/*`) con logs estructurados, sanitización de PII y
`x-request-id`. Documentación vigente:
[`docs/ETAPA4_OBSERVABILIDAD_RUNBOOK.md`](./ETAPA4_OBSERVABILIDAD_RUNBOOK.md).

Sentry **no** está instalado por defecto. Sin DSN no hay envío externo.

Para activar Sentry (decisión del owner):

1. Crear proyecto Next.js en Sentry y obtener el **DSN**.
2. `npm install @sentry/nextjs`
3. Ejecutar `npx @sentry/wizard@latest -i nextjs` o config manual.
4. Añadir `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` en Vercel proyecto **`ilara`**
   (nunca `ilara-app`) y opcionalmente `SENTRY_AUTH_TOKEN` en CI para source maps.
5. Enganchar `beforeSend` con `sanitizeForTelemetry` de `lib/observability`.
6. Ampliar CSP `connect-src` para el ingest de Sentry.

Sin DSN, la app funciona igual; no es obligatorio para desarrollo local.
