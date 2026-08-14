/**
 * Creación de pedidos de catálogo: payload, parse y errores (puro).
 */
import { AppError, mapRpcMessageToAppError } from '@/lib/domain/errors'
import { isOrderStatus } from '@/lib/domain/orders/states'
import type { CreateOrderInput, CreateOrderResult } from '@/lib/domain/orders/types'
import { buildCreateOrderRpcPayload } from '@/lib/domain/orders/validation'

export { buildCreateOrderRpcPayload }

export function parseCreateOrderRpcResult(rpcData: unknown): CreateOrderResult {
  const r = (rpcData && typeof rpcData === 'object' ? rpcData : {}) as Record<string, unknown>
  const order_number = String(r.order_number || '')
  const order_id = String(r.order_id || '')
  const statusRaw = String(r.status || '')
  if (!order_number || !order_id || !isOrderStatus(statusRaw)) {
    throw new AppError('unknown', 'No se pudo registrar el pedido. Intentá de nuevo.', {
      message: 'invalid_order_result',
      retryable: true,
    })
  }
  return {
    order_id,
    order_number,
    status: statusRaw,
    subtotal: Number(r.subtotal) || 0,
    discount_total: Number(r.discount_total) || 0,
    shipping_amount: Number(r.shipping_amount) || 0,
    shipping_currency: String(r.shipping_currency || 'ARS'),
    shipping_carrier: String(r.shipping_carrier || ''),
    shipping_service: String(r.shipping_service || ''),
    shipping_delivery_estimate: r.shipping_delivery_estimate == null ? null : String(r.shipping_delivery_estimate),
    shipping_destination_postal_code: String(r.shipping_destination_postal_code || ''),
    shipping_destination_city: String(r.shipping_destination_city || ''),
    shipping_destination_state: String(r.shipping_destination_state || ''),
    total: Number(r.total) || 0,
    created_at: String(r.created_at || new Date().toISOString()),
    idempotent_replay: Boolean(r.idempotent_replay),
  }
}

export function createOrderErrorFromRpc(message: string): AppError {
  const m = message || ''
  if (m.includes('invalid_coupon')) {
    return new AppError('validation', 'El cupón no es válido o ya no está activo.', {
      message: 'invalid_coupon',
    })
  }
  if (m.includes('product_not_available') || m.includes('combo_not_available')) {
    return new AppError(
      'conflict',
      'Algunos productos ya no están disponibles. Actualizá la bolsa e intentá de nuevo.',
      { message: 'product_not_available', retryable: true }
    )
  }
  if (m.includes('client_price_not_allowed')) {
    return new AppError('validation', 'No se pudo procesar el pedido. Intentá de nuevo.', {
      message: 'client_price_not_allowed',
    })
  }
  if (m.includes('shipping_quote_required') || m.includes('invalid_shipping_quote')) {
    return new AppError('validation', 'Volvé a cotizar y elegí una opción de envío.', {
      message: 'invalid_shipping_quote',
    })
  }
  if (m.includes('shipping_quote_expired')) {
    return new AppError('conflict', 'La cotización venció. Cotizá el envío nuevamente.', {
      message: 'shipping_quote_expired', retryable: true,
    })
  }
  if (m.includes('shipping_quote_consumed')) {
    return new AppError('conflict', 'Esa cotización ya fue utilizada. Cotizá nuevamente.', {
      message: 'shipping_quote_consumed', retryable: true,
    })
  }
  if (m.includes('rate_limited')) {
    return new AppError(
      'validation',
      'Alcanzaste el límite de pedidos por ahora. Probá más tarde o escribinos por WhatsApp.',
      { message: 'rate_limited', retryable: true }
    )
  }
  if (m.includes('invalid_customer_phone')) {
    return new AppError('validation', 'Ingresá un teléfono válido (solo números, 8 a 15 dígitos).', {
      message: 'invalid_customer_phone',
    })
  }
  if (m.includes('invalid_customer_name')) {
    return new AppError('validation', 'Ingresá tu nombre.', { message: 'invalid_customer_name' })
  }
  if (m.includes('invalid_idempotency_key')) {
    return new AppError('validation', 'No se pudo iniciar el pedido. Recargá e intentá de nuevo.', {
      message: 'invalid_idempotency_key',
      retryable: true,
    })
  }
  if (m.includes('idempotency_conflict')) {
    return new AppError(
      'conflict',
      'La bolsa cambió durante el reintento. Cerrá el checkout y volvé a confirmarla.',
      { message: 'idempotency_conflict' }
    )
  }
  if (m.includes('empty_lines') || m.includes('too_many_lines')) {
    return new AppError('validation', 'Revisá el contenido de tu bolsa e intentá de nuevo.', {
      message: 'empty_lines',
    })
  }
  // Reusar mapeo Stage 5 para stock/auth/combo/quantity.
  return mapRpcMessageToAppError(m)
}

export function buildCreateOrderPayload(input: CreateOrderInput): Record<string, unknown> {
  return buildCreateOrderRpcPayload(input)
}
