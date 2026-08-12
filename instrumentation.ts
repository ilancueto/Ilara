/**
 * Next.js instrumentation (Stage 4).
 * Captura errores de request en servidor con logs estructurados y sin PII.
 * @see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md
 */

import type { Instrumentation } from 'next'
import { trackError, ObservabilityEvent } from '@/lib/observability'

export async function register() {
  // Placeholder para OpenTelemetry / Sentry init cuando el owner active DSN.
  // Sin dependencias externas obligatorias.
  if (process.env.NODE_ENV === 'development' && process.env.LOG_OBS === '1') {
    console.info(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: 'info',
        event: 'instrumentation.register',
        message: 'Ilara instrumentation registered',
      })
    )
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  const path =
    typeof request === 'object' && request && 'path' in request
      ? String((request as { path?: string }).path || '')
      : ''
  const headers =
    typeof request === 'object' && request && 'headers' in request
      ? (request as { headers?: Record<string, string | string[] | undefined> })
          .headers
      : undefined
  const requestIdRaw =
    headers?.['x-request-id'] ||
    headers?.['x-correlation-id'] ||
    undefined
  const requestId = Array.isArray(requestIdRaw)
    ? requestIdRaw[0]
    : requestIdRaw

  // Solo metadatos de routing; trackError sanitiza message/meta.
  // No pasar headers completos ni body.
  const safeRequestId =
    requestId && /^[\w\-.:]{1,128}$/.test(String(requestId))
      ? String(requestId)
      : undefined

  trackError(err, {
    event: ObservabilityEvent.SERVER_ERROR,
    route: path.split('?')[0]?.slice(0, 200),
    requestId: safeRequestId,
    meta: {
      routerKind: context?.routerKind,
      routeType: context?.routeType,
      renderSource: context?.renderSource,
    },
  })
}
