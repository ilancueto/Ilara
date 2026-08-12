import { sanitizeForTelemetry, sanitizeString } from '@/lib/observability/sanitize'
import type { ObservabilityPayload } from '@/lib/observability/events'

export type LogRecord = {
  ts: string
  level: string
  event: string
  requestId?: string
  code?: string
  route?: string
  durationMs?: number
  status?: number
  message?: string
  meta?: unknown
  env?: string
}

function shouldEmit(): boolean {
  // En Vitest no saturar stdout salvo LOG_OBS=1
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') {
    return process.env.LOG_OBS === '1'
  }
  return true
}

/**
 * Log estructurado (JSON) a stdout. Sin sinks externos obligatorios.
 * Todo campo pasa por sanitización.
 */
export function logStructured(payload: ObservabilityPayload): void {
  if (!shouldEmit()) return

  const routeRaw = payload.route ? String(payload.route).split('?')[0] : undefined
  const requestIdRaw = payload.requestId ? String(payload.requestId) : undefined

  const record: LogRecord = {
    ts: new Date().toISOString(),
    level: payload.level || 'info',
    event: sanitizeString(String(payload.event), 120),
    requestId: requestIdRaw
      ? sanitizeString(requestIdRaw, 128)
      : undefined,
    code: payload.code ? sanitizeString(String(payload.code), 64) : undefined,
    route: routeRaw ? sanitizeString(routeRaw, 200) : undefined,
    durationMs:
      typeof payload.durationMs === 'number' && Number.isFinite(payload.durationMs)
        ? payload.durationMs
        : undefined,
    status:
      typeof payload.status === 'number' && Number.isFinite(payload.status)
        ? payload.status
        : undefined,
    message: payload.message
      ? String(sanitizeForTelemetry(payload.message))
      : undefined,
    meta: payload.meta ? sanitizeForTelemetry(payload.meta) : undefined,
    env: process.env.VERCEL_ENV || process.env.NODE_ENV,
  }

  const line = JSON.stringify(record)
  if (record.level === 'error' || record.level === 'warn') {
    console.error(line)
  } else {
    console.info(line)
  }
}

export function createRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}
