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
  /** Stage 6.1 — pedidos catálogo (sin PII). */
  ORDER_CREATE_STARTED: 'order_create_started',
  ORDER_CREATE_SUCCEEDED: 'order_create_succeeded',
  ORDER_CREATE_FAILED: 'order_create_failed',
  ORDER_STATUS_CHANGED: 'order_status_changed',
  ORDER_CONFIRMATION_FAILED: 'order_confirmation_failed',
  ORDER_CANCEL_FAILED: 'order_cancel_failed',
  /** Stage 6.2 — alertas de reposición (sin PII). */
  STOCK_ALERT_OPENED: 'stock_alert_opened',
  STOCK_ALERT_TAKEN: 'stock_alert_taken',
  STOCK_ALERT_RESOLVED: 'stock_alert_resolved',
  STOCK_ALERT_DISMISSED: 'stock_alert_dismissed',
  STOCK_ALERT_AUTO_RESOLVED: 'stock_alert_auto_resolved',
  STOCK_ALERT_TRANSITION_FAILED: 'stock_alert_transition_failed',
  /** Stage 6.3 — devoluciones y notas de crédito (sin motivo/PII). */
  SALE_RETURN_CREATED: 'sale_return_created',
  SALE_RETURN_FAILED: 'sale_return_failed',
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
