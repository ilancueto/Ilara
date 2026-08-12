# Etapa 4 — Observabilidad segura (OBS-01)

- **Estado local:** implementado (logs estructurados + correlation ID + eventos sin PII)
- **Estado producción / remoto:** **no** configurado ni verificado; sin telemetría externa
- **Sentry/OTel:** opt-in del owner (paquete no instalado)
- **Fecha:** 2026-08-12

## 1. Qué hay en el repo (implementado localmente)

| Pieza | Ubicación | Comportamiento |
|---|---|---|
| Sanitización | `lib/observability/sanitize.ts` | Redacta email, phone, tokens, receipts, notes, cookies |
| Eventos | `lib/observability/events.ts` | Nombres estables sin PII |
| Logger JSON | `lib/observability/logger.ts` | stdout estructurado |
| API | `lib/observability/report.ts` | `trackEvent` / `trackError` / `trackLoginFailure` |
| Request ID | `proxy.ts` | Header `x-request-id` (entra o se genera) |
| Errores server | `instrumentation.ts` → `onRequestError` | Log sanitizado |
| Errores UI | `app/error.tsx`, `app/global-error.tsx` | `trackError` + UI reintento |
| Login | `components/Login.tsx` | fallo/éxito sin email |
| POS | `components/PuntoVenta/PuntoVenta.tsx` | stock conflict / RPC error |

**Sentry:** desactivado sin DSN. El paquete `@sentry/nextjs` **no** está instalado
por defecto (evita dependencia y bundle). La capa no envía datos a terceros en tests.

## 2. Esquema de eventos (sin PII)

| Evento | Cuándo | Campos permitidos |
|---|---|---|
| `auth.login_failure` | Credenciales inválidas | `code` |
| `auth.login_success` | Login OK | (sin user id en v1) |
| `auth.unauthorized` | Reserva | `route` |
| `sales.rpc_error` | Fallo RPC venta | `code`, `route` |
| `sales.stock_conflict` | Stock insuficiente | `code` |
| `storage.error` | Fallo Storage | `code`, `route` |
| `http.5xx` | Reserva HTTP | `status`, `route` |
| `client.error` | Error boundary | `code` (digest) |
| `server.error` | `onRequestError` | `route`, `requestId` |
| `perf.latency` | Reserva métricas | `durationMs`, `route` |

**Prohibido en meta/message:** email, teléfono, nombre de cliente, notas, URL de
comprobante, body de venta, cookies, tokens, service_role, JWT.

### Límites de sanitización (honestos)

La capa usa **regex + allowlist de headers**, no un DLP completo:

- Redacta claves con nombres sensibles y valores con JWT/email/tel/keys conocidos.
- **No** garantiza ofuscar PII en campos con nombres inocentes (`label`, `detail`).
- Regla de oro: **no** pasar payloads de venta, filas de DB ni `error` crudos a
  `trackEvent`/`console` fuera del logger sanitizado.
- Stack traces sólo en `development` y ya sanitizados.

## 3. Correlation / request ID

1. Cliente o edge puede enviar `x-request-id` o `x-correlation-id`.
2. `proxy.ts` valida (charset acotado) o genera UUID.
3. Se refleja en la respuesta HTTP `x-request-id`.
4. `onRequestError` intenta leerlo de headers del request.

## 4. Activar Sentry (owner — no obligatorio)

1. Crear proyecto Next.js en Sentry.
2. `npm install @sentry/nextjs` (justificación: captura errores prod + source maps).
3. `npx @sentry/wizard@latest -i nextjs` o config manual.
4. Variables en Vercel proyecto **`ilara`** (nunca `ilara-app`):
   - `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN`
   - `SENTRY_AUTH_TOKEN` solo en CI de source maps (secreto)
5. Configurar `beforeSend` con `sanitizeForTelemetry` (ya existe en repo).
6. Añadir `https://*.ingest.sentry.io` a CSP `connect-src` en `next.config.ts`.
7. Probar con error sintético controlado en staging/local, no en POS real.

## 5. Alertas (a configurar luego — no implementadas en proveedor)

| Alerta | Señal | Propuesta umbral |
|---|---|---|
| Login failures | `auth.login_failure` | > 20 / 5 min |
| Sale RPC errors | `sales.rpc_error` | > 3 / 10 min |
| Stock conflicts | `sales.stock_conflict` | info; spike > 10 / 15 min |
| Storage errors | `storage.error` | > 1 / 15 min |
| 5xx / server.error | `server.error` / `client.error` | > 5 / 5 min |
| Latency | `perf.latency` p95 | > 3s en rutas app |

## 6. Runbook de respuesta (resumen)

1. Tomar `requestId` / `digest` del log (sin copiar PII).
2. Clasificar: auth, venta, storage, UI.
3. Verificar Vercel logs + Supabase logs (solo lectura).
4. Si hay sospecha de fuga: rotar secretos (`docs/RUNBOOK_ROTACION_SECRETOS.md`).
5. Si hay incidente de venta/stock: no “arreglar” con SQL ad-hoc en prod sin backup.

## 7. Tests

- Unit: `lib/__tests__/observability.sanitize.test.ts`
- En Vitest/Playwright no se envía a sinks externos (`isSentryEnabled()` false).
- Forzar logs en test: `LOG_OBS=1`
