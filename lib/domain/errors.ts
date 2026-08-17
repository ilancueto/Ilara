/**
 * Taxonomía mínima de errores de aplicación (Stage 5).
 * - UI: mensajes seguros y accionables (`userMessage`).
 * - Logs: usar `code` + contexto sanitizado (Stage 4 observability).
 */

export type AppErrorCode =
  | 'auth'
  | 'forbidden'
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'stock'
  | 'network'
  | 'unknown'

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly userMessage: string
  readonly retryable: boolean

  constructor(
    code: AppErrorCode,
    userMessage: string,
    options?: { cause?: unknown; retryable?: boolean; message?: string }
  ) {
    super(options?.message ?? userMessage, options?.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'AppError'
    this.code = code
    this.userMessage = userMessage
    this.retryable = options?.retryable ?? false
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError
}

/** Mensaje seguro para mostrar al usuario. */
export function toUserMessage(err: unknown, fallback = 'Ocurrió un error. Intentá de nuevo.'): string {
  if (isAppError(err)) return err.userMessage
  if (err && typeof err === 'object' && 'message' in err) {
    const m = String((err as { message: unknown }).message || '')
    // No filtrar mensajes de negocio conocidos del RPC hacia el usuario sin mapear.
    if (!m || m.length > 200) return fallback
  }
  return fallback
}

/**
 * Mapea códigos/mensajes de RPC Supabase a AppError (sin PII ni payload).
 */
export function mapRpcMessageToAppError(raw: string): AppError {
  const m = raw || ''
  if (m.includes('insufficient_stock')) {
    return new AppError('stock', 'No hay stock suficiente para esta venta. Actualizá el catálogo e intentá de nuevo.', {
      message: 'insufficient_stock',
      retryable: true,
    })
  }
  if (m.includes('not_authenticated')) {
    return new AppError('auth', 'Sesión expirada. Volvé a iniciar sesión.', { message: 'not_authenticated' })
  }
  if (m.includes('not_authorized') || m.includes('invalid_access_capability')) {
    return new AppError('forbidden', 'No tenés permiso para esta operación.', { message: 'not_authorized' })
  }
  if (
    m.includes('payment_mismatch') ||
    m.includes('payment_breakdown_required') ||
    m.includes('payment_breakdown_not_allowed')
  ) {
    return new AppError('validation', 'El desglose de pago no coincide con el total. Revisá los montos.', {
      message: 'payment_mismatch',
    })
  }
  if (m.includes('invalid_payment') || m.includes('invalid_status')) {
    return new AppError('validation', 'Método de pago o estado inválido. Revisá el cobro e intentá de nuevo.', {
      message: 'invalid_payment',
    })
  }
  if (m.includes('invalid_catalog_price')) {
    return new AppError('validation', 'Hay productos o combos sin precio válido. Revisá el inventario.', {
      message: 'invalid_catalog_price',
    })
  }
  if (m.includes('invalid_combo')) {
    return new AppError('conflict', 'Uno de los combos ya no es válido. Actualizá la página.', {
      message: 'invalid_combo',
      retryable: true,
    })
  }
  if (m.includes('empty_combo')) {
    return new AppError('validation', 'Uno de los combos no tiene productos configurados.', {
      message: 'empty_combo',
    })
  }
  if (m.includes('invalid_quantity')) {
    return new AppError('validation', 'Cantidades inválidas en el carrito. Revisá las cantidades e intentá de nuevo.', {
      message: 'invalid_quantity',
    })
  }
  return new AppError('unknown', 'No se pudo completar la operación. Intentá de nuevo.', {
    message: m.split(/[:\s]/)[0]?.slice(0, 64) || 'rpc_error',
    retryable: true,
  })
}
