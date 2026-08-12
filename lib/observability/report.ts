/**
 * Capa de captura de errores opt-in (Stage 4).
 * - Siempre: log estructurado local (sanitizado).
 * - Sentry: desactivado sin DSN. El paquete @sentry/nextjs NO está instalado
 *   por defecto; ver docs/ETAPA4_OBSERVABILIDAD_RUNBOOK.md para activarlo.
 * - Nunca envía eventos a servicios externos en tests.
 */

import { logStructured, createRequestId } from '@/lib/observability/logger'
import { sanitizeForTelemetry } from '@/lib/observability/sanitize'
import {
  ObservabilityEvent,
  mapErrorCodeToEvent,
  type ObservabilityPayload,
} from '@/lib/observability/events'

export { createRequestId, ObservabilityEvent, mapErrorCodeToEvent }
export type { ObservabilityPayload }

function sentryDsn(): string | undefined {
  const dsn =
    process.env.SENTRY_DSN?.trim() ||
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()
  return dsn || undefined
}

function isTestEnv(): boolean {
  return (
    process.env.VITEST === 'true' ||
    process.env.NODE_ENV === 'test' ||
    process.env.PLAYWRIGHT_TEST === '1'
  )
}

/**
 * True sólo si hay DSN y no estamos en test.
 * Aun con DSN, sin @sentry/nextjs instalado no hay envío externo
 * (la integración real es opt-in manual del owner).
 */
export function isSentryEnabled(): boolean {
  if (isTestEnv()) return false
  return Boolean(sentryDsn())
}

/** Emite un evento de negocio/técnico. No lanza. */
export function trackEvent(payload: ObservabilityPayload): void {
  try {
    logStructured(payload)
  } catch {
    /* never break app flow */
  }
}

export function trackError(
  error: unknown,
  context: Omit<ObservabilityPayload, 'event' | 'level'> & {
    event?: string
  } = {}
): void {
  try {
    const err = error instanceof Error ? error : new Error(String(error))
    const code =
      context.code ||
      (typeof error === 'object' &&
      error &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : undefined)
    const mapped = mapErrorCodeToEvent(code)
    const payload: ObservabilityPayload = {
      event: context.event || mapped || ObservabilityEvent.SERVER_ERROR,
      level: 'error',
      requestId: context.requestId,
      code,
      route: context.route,
      durationMs: context.durationMs,
      status: context.status,
      message: String(sanitizeForTelemetry(err.message)),
      meta: {
        name: err.name,
        ...(context.meta ? (sanitizeForTelemetry(context.meta) as object) : {}),
      },
    }
    logStructured(payload)
  } catch {
    /* never break app flow */
  }
}

/** Cliente: fallo de login sin email ni password. */
export function trackLoginFailure(reasonCode?: string): void {
  trackEvent({
    event: ObservabilityEvent.LOGIN_FAILURE,
    level: 'warn',
    code: reasonCode || 'invalid_credentials',
    message: 'Login failed',
  })
}
