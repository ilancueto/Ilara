# Observabilidad — Sentry

La app usa **Vercel Analytics** y **Speed Insights** desde `app/layout.tsx`, una capa propia de
logs estructurados con sanitización de datos personales (`lib/observability/*`, ver
[`ETAPA4_OBSERVABILIDAD_RUNBOOK.md`](./ETAPA4_OBSERVABILIDAD_RUNBOOK.md)) y, desde noviembre de 2026,
**Sentry** para recibir los errores en un panel.

## Cómo está integrado

- Todos los errores ya pasan por `trackError` (`lib/observability/report.ts`). Esa función, además del
  log local, reenvía el error a Sentry con `captureToSentry` (`lib/observability/sentry.ts`).
- **Opt-in por DSN:** sin `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` no se carga el SDK ni se envía nada.
  En tests (`VITEST`, `NODE_ENV=test`, `PLAYWRIGHT_TEST`) tampoco. `scripts/run-cloud-tests.mjs` vacía
  ambas variables para que los e2e de staging no generen ruido en el proyecto real.
- **Carga diferida:** el SDK (`@sentry/nextjs`) se importa con `import()` cuando el navegador está libre
  (`instrumentation-client.ts`) o en el arranque del servidor (`instrumentation.ts`). No entra en el JS
  inicial del catálogo.
- **Privacidad:** cada evento pasa por `scrubSentryEvent` antes de salir: sin usuario, cookies, headers,
  query strings (ahí viajan tokens de seguimiento), breadcrumbs ni datos del cuerpo de la petición;
  mensajes y contextos pasan por `sanitizeForTelemetry`. Los límites de esa sanitización (regex, no
  anonimización perfecta) están descritos en `lib/observability/sanitize.ts`.
- **Cuota gratuita:** sólo errores; `tracesSampleRate: 0`, sin session replay ni breadcrumbs.
- **CSP:** `next.config.ts` agrega al `connect-src` únicamente el origen de ingesta del DSN configurado.

## Variables de entorno (Vercel, proyecto `ilara`)

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Navegador (se incorpora en el build) |
| `SENTRY_DSN` | Servidor |

Si se cambia el DSN hay que **redesplegar**: la variable pública se fija en el build.
Nunca configurar el DSN con valores de otro proyecto de Vercel (`ilara-app` no es un destino).

## Qué no incluye

- Source maps subidos a Sentry (`SENTRY_AUTH_TOKEN` + `withSentryConfig`): los stacks del navegador
  llegan minificados. Se puede sumar más adelante si hace falta.
- Alertas por email o Slack: se configuran en el panel de Sentry (Alerts), no en el código.

## Verificación

`lib/__tests__/sentryReporting.test.ts` cubre el opt-in, el origen del CSP y la sanitización del evento.
Para comprobar el envío real basta forzar un error con el DSN configurado y buscarlo en el panel por la
etiqueta `route`.
