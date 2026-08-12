/**
 * Esquema de eventos técnicos/negocio sin PII (Stage 4 / OBS-01).
 * Los nombres son estables para alertas futuras; no incluyen emails, teléfonos,
 * notas, comprobantes ni payloads de venta.
 */

export const ObservabilityEvent = {
  LOGIN_FAILURE: 'auth.login_failure',
  LOGIN_SUCCESS: 'auth.login_success',
  SALE_RPC_ERROR: 'sales.rpc_error',
  STOCK_CONFLICT: 'sales.stock_conflict',
  STORAGE_ERROR: 'storage.error',
  HTTP_5XX: 'http.5xx',
  CLIENT_ERROR: 'client.error',
  SERVER_ERROR: 'server.error',
  LATENCY_SAMPLE: 'perf.latency',
  UNAUTHORIZED: 'auth.unauthorized',
} as const

export type ObservabilityEventName =
  (typeof ObservabilityEvent)[keyof typeof ObservabilityEvent]

export type ObservabilityLevel = 'debug' | 'info' | 'warn' | 'error'

export type ObservabilityPayload = {
  event: ObservabilityEventName | string
  level?: ObservabilityLevel
  /** Correlation / request id (no PII). */
  requestId?: string
  /** Código de error técnico estable (p.ej. PGRST301, STOCK_INSUFFICIENT). */
  code?: string
  /** Ruta o superficie (sin query con tokens). */
  route?: string
  /** Duración en ms si aplica. */
  durationMs?: number
  /** HTTP status si aplica. */
  status?: number
  /** Mensaje ya sanitizado o genérico. */
  message?: string
  /** Campos extra ya sanitizados (nunca PII). */
  meta?: Record<string, unknown>
}

/** Códigos de RPC/stock conocidos → eventos de negocio. */
export function mapErrorCodeToEvent(code: string | undefined | null): ObservabilityEventName | null {
  if (!code) return null
  const c = code.toUpperCase()
  if (c.includes('STOCK') || c === '23514' || c.includes('INSUFFICIENT')) {
    return ObservabilityEvent.STOCK_CONFLICT
  }
  if (c.includes('SALE') || c.includes('RPC') || c.startsWith('P0001')) {
    return ObservabilityEvent.SALE_RPC_ERROR
  }
  if (c.includes('STORAGE') || c.includes('BUCKET') || c.includes('RECEIPT')) {
    return ObservabilityEvent.STORAGE_ERROR
  }
  return null
}
