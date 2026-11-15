/**
 * Capa de captura de errores opt-in (Stage 4).
 * - Siempre: log estructurado local (sanitizado).
 * - Sentry: opt-in. Sin DSN no se carga ni se envía nada (ver lib/observability/sentry.ts
 *   y docs/OBSERVABILIDAD_SENTRY.md). Los eventos salen sanitizados.
 * - Nunca envía eventos a servicios externos en tests.
 */

import { logStructured, createRequestId } from '@/lib/observability/logger'
import { sanitizeForTelemetry } from '@/lib/observability/sanitize'
import { captureToSentry, isSentryEnabled } from '@/lib/observability/sentry'
import {
  ObservabilityEvent,
  mapErrorCodeToEvent,
  type ObservabilityPayload,
} from '@/lib/observability/events'

export { createRequestId, ObservabilityEvent, mapErrorCodeToEvent }
export type { ObservabilityPayload }

export { isSentryEnabled }

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
    captureToSentry(err, payload)
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
