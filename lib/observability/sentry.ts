/**
 * Envío opt-in de errores a Sentry.
 *
 * - Sin DSN (o en tests) no se carga nada: cero costo y cero envío externo.
 * - El SDK se importa de forma diferida: no entra en el JS inicial del catálogo.
 * - Todo evento pasa por `scrubSentryEvent` (sanitizeForTelemetry) antes de salir:
 *   sin cookies, headers, query strings, usuario ni breadcrumbs con datos.
 * - Sólo errores: sin trazas de performance ni session replay (cuida la cuota gratuita).
 */
import type { ErrorEvent } from '@sentry/nextjs'
import { sanitizeForTelemetry, sanitizeString } from '@/lib/observability/sanitize'
import type { ObservabilityPayload } from '@/lib/observability/events'
import { readSentryDsn } from '@/lib/observability/sentryDsn'

type SentryModule = typeof import('@sentry/nextjs')

let loading: Promise<SentryModule | null> | null = null

function isTestEnv(): boolean {
  return (
    process.env.VITEST === 'true' ||
    process.env.NODE_ENV === 'test' ||
    process.env.PLAYWRIGHT_TEST === '1'
  )
}

/** True sólo si hay DSN y no estamos en test. */
export function isSentryEnabled(): boolean {
  if (isTestEnv()) return false
  return Boolean(readSentryDsn())
}

/** Quita todo lo que pueda contener datos personales antes de enviar el evento. */
export function scrubSentryEvent<T extends ErrorEvent>(event: T): T {
  delete event.user
  if (event.request) {
    event.request = { url: event.request.url?.split('?')[0] }
  }
  if (event.message) event.message = sanitizeString(event.message)
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = sanitizeString(exception.value)
  }
  if (event.extra) event.extra = sanitizeForTelemetry(event.extra) as typeof event.extra
  if (event.contexts) event.contexts = sanitizeForTelemetry(event.contexts) as typeof event.contexts
  event.breadcrumbs = undefined
  return event
}

function loadSentry(): Promise<SentryModule | null> {
  if (!isSentryEnabled()) return Promise.resolve(null)
  loading ??= import('@sentry/nextjs')
    .then((Sentry) => {
      if (!Sentry.getClient()) {
        Sentry.init({
          dsn: readSentryDsn(),
          environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV,
          release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA,
          tracesSampleRate: 0,
          maxBreadcrumbs: 0,
          ignoreErrors: ['ResizeObserver loop', 'Non-Error promise rejection captured'],
          beforeSend: (event) => scrubSentryEvent(event),
        })
      }
      return Sentry
    })
    .catch(() => null)
  return loading
}

/** Precarga el SDK cuando el navegador está libre (captura también errores no controlados). */
export function warmSentry(): void {
  if (!isSentryEnabled()) return
  const start = () => void loadSentry()
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(start, { timeout: 4000 })
  } else {
    setTimeout(start, 2000)
  }
}

/** Reenvía un error ya normalizado. Nunca lanza ni bloquea el flujo de la app. */
export function captureToSentry(error: Error, payload: ObservabilityPayload): void {
  if (!isSentryEnabled()) return
  void loadSentry()
    .then((Sentry) => {
      if (!Sentry) return
      Sentry.withScope((scope) => {
        scope.setLevel('error')
        scope.setTag('obs_event', String(payload.event))
        if (payload.route) scope.setTag('route', payload.route)
        if (payload.requestId) scope.setTag('request_id', payload.requestId)
        if (payload.code) scope.setTag('code', payload.code)
        if (payload.meta) scope.setContext('meta', sanitizeForTelemetry(payload.meta) as Record<string, unknown>)
        Sentry.captureException(error)
      })
    })
    .catch(() => {
      /* never break app flow */
    })
}
