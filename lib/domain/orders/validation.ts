/**
 * Validación pura de input de pedidos (espejo de reglas del RPC).
 * No consulta DB; la autoridad final es Postgres.
 */
import { AppError } from '@/lib/domain/errors'
import { isFulfillmentMode, type FulfillmentMode } from '@/lib/domain/orders/fulfillment'
import type { CreateOrderInput, CreateOrderLineInput } from '@/lib/domain/orders/types'

const NAME_MAX = 80
const NOTES_MAX = 500
const IDEM_MIN = 16
const IDEM_MAX = 80
const MAX_LINES = 40
const MAX_QTY = 99

export function normalizePhoneDigits(raw: string): string {
  return String(raw || '').replace(/\D/g, '')
}

/** Evita inyectar sintaxis de filtros PostgREST en la búsqueda administrativa. */
export function sanitizeOrderSearchQuery(raw: string): string {
  return String(raw || '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

export function isValidOrderPhone(digits: string): boolean {
  return digits.length >= 8 && digits.length <= 15
}

export function isValidOrderEmail(email: string | null | undefined): boolean {
  if (email == null || email === '') return true
  const e = email.trim().toLowerCase()
  if (e.length > 120) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

export function isValidIdempotencyKey(key: string): boolean {
  const k = key.trim()
  return k.length >= IDEM_MIN && k.length <= IDEM_MAX
}

export function validateOrderLineInput(line: CreateOrderLineInput, index: number): void {
  const qty = Math.floor(Number(line.quantity))
  if (!Number.isFinite(qty) || qty <= 0 || qty > MAX_QTY) {
    throw new AppError('validation', `Cantidad inválida en la línea ${index + 1}.`, {
      message: 'invalid_quantity',
    })
  }
  if (line.line_type === 'product') {
    if (!line.product_id || line.product_id <= 0) {
      throw new AppError('validation', `Producto inválido en la línea ${index + 1}.`, {
        message: 'invalid_product_line',
      })
    }
  } else if (line.line_type === 'combo') {
    if (!line.combo_id || line.combo_id <= 0) {
      throw new AppError('validation', `Combo inválido en la línea ${index + 1}.`, {
        message: 'invalid_combo',
      })
    }
  } else {
    throw new AppError('validation', `Tipo de línea inválido (${index + 1}).`, {
      message: 'invalid_line_type',
    })
  }
}

/** Valida y normaliza el input de creación. Lanza AppError si falla. */
export function normalizeCreateOrderInput(input: CreateOrderInput): {
  idempotency_key: string
  fulfillment_mode: FulfillmentMode
  shipping_quote_id: string | null
  fulfillment_zone: string | null
  customer_name: string
  customer_phone: string
  customer_email: string | null
  notes: string | null
  coupon_code: string | null
  lines: Array<{ line_type: 'product' | 'combo'; product_id?: number; combo_id?: number; quantity: number }>
} {
  const idempotency_key = String(input.idempotency_key || '').trim()
  if (!isValidIdempotencyKey(idempotency_key)) {
    throw new AppError('validation', 'No se pudo iniciar el pedido. Recargá e intentá de nuevo.', {
      message: 'invalid_idempotency_key',
    })
  }

  const requestedMode = input.fulfillment_mode
  const shipping_quote_id = String(input.shipping_quote_id || '').trim().toLowerCase()
  const fulfillment_mode: FulfillmentMode = isFulfillmentMode(requestedMode)
    ? requestedMode
    : shipping_quote_id
      ? 'envio'
      : 'envio'
  if (requestedMode != null && !isFulfillmentMode(requestedMode)) {
    throw new AppError('validation', 'Elegí cómo querés recibir el pedido.', {
      message: 'invalid_fulfillment_mode',
    })
  }

  if (fulfillment_mode === 'envio') {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(shipping_quote_id)) {
      throw new AppError('validation', 'Volvé a cotizar y elegí una opción de envío.', {
        message: 'invalid_shipping_quote',
      })
    }
  } else if (shipping_quote_id) {
    throw new AppError('validation', 'Ese tipo de entrega no usa cotización de correo.', {
      message: 'fulfillment_shipping_conflict',
    })
  }

  const zoneRaw = input.fulfillment_zone != null ? String(input.fulfillment_zone).trim() : ''
  if (zoneRaw.length > 80) {
    throw new AppError('validation', 'La zona no puede superar 80 caracteres.', {
      message: 'invalid_fulfillment_zone',
    })
  }

  const customer_name = String(input.customer_name || '').trim()
  if (!customer_name || customer_name.length > NAME_MAX) {
    throw new AppError('validation', 'Ingresá tu nombre (máximo 80 caracteres).', {
      message: 'invalid_customer_name',
    })
  }

  const customer_phone = normalizePhoneDigits(String(input.customer_phone || ''))
  if (!isValidOrderPhone(customer_phone)) {
    throw new AppError('validation', 'Ingresá un teléfono válido (solo números, 8 a 15 dígitos).', {
      message: 'invalid_customer_phone',
    })
  }

  const rawEmail = input.customer_email != null ? String(input.customer_email).trim() : ''
  if (!isValidOrderEmail(rawEmail || null)) {
    throw new AppError('validation', 'El email no tiene un formato válido.', {
      message: 'invalid_customer_email',
    })
  }

  const notesRaw = input.notes != null ? String(input.notes).trim() : ''
  if (notesRaw.length > NOTES_MAX) {
    throw new AppError('validation', `Las notas no pueden superar ${NOTES_MAX} caracteres.`, {
      message: 'invalid_notes',
    })
  }

  const lines = input.lines || []
  if (!lines.length) {
    throw new AppError('validation', 'El carrito está vacío.', { message: 'empty_lines' })
  }
  if (lines.length > MAX_LINES) {
    throw new AppError('validation', 'Demasiados productos en el carrito.', {
      message: 'too_many_lines',
    })
  }

  const normalizedLines = lines.map((line, i) => {
    validateOrderLineInput(line, i)
    const qty = Math.floor(Number(line.quantity))
    if (line.line_type === 'product') {
      return { line_type: 'product' as const, product_id: Number(line.product_id), quantity: qty }
    }
    return { line_type: 'combo' as const, combo_id: Number(line.combo_id), quantity: qty }
  })

  const coupon_code = input.coupon_code
    ? String(input.coupon_code).trim().toUpperCase() || null
    : null

  return {
    idempotency_key,
    fulfillment_mode,
    shipping_quote_id: fulfillment_mode === 'envio' ? shipping_quote_id : null,
    fulfillment_zone: fulfillment_mode === 'coordinar' ? (zoneRaw || null) : null,
    customer_name,
    customer_phone,
    customer_email: rawEmail ? rawEmail.toLowerCase() : null,
    notes: notesRaw || null,
    coupon_code,
    lines: normalizedLines,
  }
}

/** Payload RPC sin precios/totales del cliente. */
export function buildCreateOrderRpcPayload(input: CreateOrderInput): Record<string, unknown> {
  const n = normalizeCreateOrderInput(input)
  return {
    idempotency_key: n.idempotency_key,
    fulfillment_mode: n.fulfillment_mode,
    ...(n.shipping_quote_id ? { shipping_quote_id: n.shipping_quote_id } : {}),
    ...(n.fulfillment_zone ? { fulfillment_zone: n.fulfillment_zone } : {}),
    customer_name: n.customer_name,
    customer_phone: n.customer_phone,
    customer_email: n.customer_email,
    notes: n.notes,
    coupon_code: n.coupon_code,
    lines: n.lines,
  }
}
