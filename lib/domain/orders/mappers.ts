/**
 * Mappers de filas admin → DTO (sin campos internos de catálogo).
 */
import { isOrderStatus, type OrderStatus } from '@/lib/domain/orders/states'
import type {
  ComboComponentSnapshot,
  OrderDetail,
  OrderItemRow,
  OrderListItem,
  OrderStatusEvent,
  TransitionOrderResult,
} from '@/lib/domain/orders/types'
import { AppError } from '@/lib/domain/errors'

function num(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null
  return typeof v === 'string' ? v : null
}

function parseStatus(v: unknown): OrderStatus {
  const s = String(v || '')
  if (!isOrderStatus(s)) {
    throw new AppError('unknown', 'Estado de pedido inválido en datos.', {
      message: 'invalid_status_data',
    })
  }
  return s
}

function parseComponents(raw: unknown): ComboComponentSnapshot[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((c) => {
      const r = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>
      return {
        product_id: num(r.product_id),
        product_name: str(r.product_name, 'Producto'),
        quantity: num(r.quantity, 1),
      }
    })
    .filter((c) => c.product_id > 0 && c.quantity > 0)
}

export function mapOrderListItem(row: unknown): OrderListItem {
  const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>
  return {
    id: str(r.id),
    order_number: str(r.order_number),
    status: parseStatus(r.status),
    channel: 'catalog',
    customer_name: str(r.customer_name),
    customer_phone: str(r.customer_phone),
    customer_email: strOrNull(r.customer_email),
    notes: strOrNull(r.notes),
    subtotal: num(r.subtotal),
    discount_total: num(r.discount_total),
    shipping_quote_id: strOrNull(r.shipping_quote_id),
    shipping_provider: strOrNull(r.shipping_provider),
    shipping_carrier: strOrNull(r.shipping_carrier),
    shipping_carrier_description: strOrNull(r.shipping_carrier_description),
    shipping_service: strOrNull(r.shipping_service),
    shipping_service_description: strOrNull(r.shipping_service_description),
    shipping_delivery_estimate: strOrNull(r.shipping_delivery_estimate),
    shipping_amount: num(r.shipping_amount),
    shipping_currency: strOrNull(r.shipping_currency),
    shipping_destination_postal_code: strOrNull(r.shipping_destination_postal_code),
    shipping_destination_city: strOrNull(r.shipping_destination_city),
    shipping_destination_state: strOrNull(r.shipping_destination_state),
    shipping_destination_province_id: strOrNull(r.shipping_destination_province_id),
    shipping_destination_locality_id: strOrNull(r.shipping_destination_locality_id),
    shipping_destination_street: strOrNull(r.shipping_destination_street),
    shipping_destination_number: strOrNull(r.shipping_destination_number),
    shipping_destination_formatted_address: strOrNull(r.shipping_destination_formatted_address),
    shipping_destination_lat: r.shipping_destination_lat == null ? null : num(r.shipping_destination_lat),
    shipping_destination_lon: r.shipping_destination_lon == null ? null : num(r.shipping_destination_lon),
    total: num(r.total),
    coupon_code: strOrNull(r.coupon_code),
    coupon_discount_percentage:
      r.coupon_discount_percentage == null ? null : num(r.coupon_discount_percentage),
    stock_reserved: Boolean(r.stock_reserved),
    created_at: str(r.created_at),
    updated_at: str(r.updated_at),
    confirmed_at: strOrNull(r.confirmed_at),
    completed_at: strOrNull(r.completed_at),
    cancelled_at: strOrNull(r.cancelled_at),
    cancel_reason: strOrNull(r.cancel_reason),
  }
}

export function mapOrderItemRow(row: unknown): OrderItemRow {
  const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>
  const lt = str(r.line_type)
  return {
    id: num(r.id),
    order_id: str(r.order_id),
    line_type: lt === 'combo' ? 'combo' : 'product',
    product_id: r.product_id == null ? null : num(r.product_id),
    combo_id: r.combo_id == null ? null : num(r.combo_id),
    name_snapshot: str(r.name_snapshot),
    variant_snapshot: strOrNull(r.variant_snapshot),
    combo_components_snapshot: parseComponents(r.combo_components_snapshot),
    quantity: num(r.quantity, 1),
    unit_price: num(r.unit_price),
    discount_percentage: num(r.discount_percentage),
    line_subtotal: num(r.line_subtotal),
    sort_order: num(r.sort_order),
  }
}

export function mapOrderStatusEvent(row: unknown): OrderStatusEvent {
  const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>
  const from = r.from_status == null ? null : parseStatus(r.from_status)
  const actor = str(r.actor_kind, 'system')
  return {
    id: num(r.id),
    order_id: str(r.order_id),
    from_status: from,
    to_status: parseStatus(r.to_status),
    actor_user_id: strOrNull(r.actor_user_id),
    actor_kind:
      actor === 'admin' || actor === 'public' || actor === 'system' ? actor : 'system',
    reason: strOrNull(r.reason),
    created_at: str(r.created_at),
  }
}

export function mapOrderDetail(
  order: unknown,
  items: unknown[],
  events: unknown[]
): OrderDetail {
  return {
    ...mapOrderListItem(order),
    items: items.map(mapOrderItemRow).sort((a, b) => a.sort_order - b.sort_order),
    events: events.map(mapOrderStatusEvent).sort((a, b) => a.id - b.id),
  }
}

export function parseTransitionOrderResult(rpcData: unknown): TransitionOrderResult {
  const r = (rpcData && typeof rpcData === 'object' ? rpcData : {}) as Record<string, unknown>
  const status = parseStatus(r.status)
  return {
    order_id: str(r.order_id),
    order_number: str(r.order_number),
    status,
    from_status: r.from_status != null ? parseStatus(r.from_status) : undefined,
    stock_reserved: Boolean(r.stock_reserved),
    idempotent_replay: Boolean(r.idempotent_replay),
  }
}

export function transitionOrderErrorFromRpc(message: string): AppError {
  const m = message || ''
  if (m.includes('invalid_transition')) {
    return new AppError('conflict', 'Esa transición de estado no está permitida.', {
      message: 'invalid_transition',
    })
  }
  if (m.includes('cancel_reason_required')) {
    return new AppError('validation', 'Indicá un motivo de cancelación.', {
      message: 'cancel_reason_required',
    })
  }
  if (m.includes('order_not_found')) {
    return new AppError('not_found', 'Pedido no encontrado.', { message: 'order_not_found' })
  }
  if (m.includes('insufficient_stock')) {
    return new AppError(
      'stock',
      'No hay stock suficiente para confirmar este pedido. Revisá el inventario.',
      { message: 'insufficient_stock', retryable: true }
    )
  }
  if (m.includes('not_authenticated')) {
    return new AppError('auth', 'Sesión expirada. Volvé a iniciar sesión.', {
      message: 'not_authenticated',
    })
  }
  if (m.includes('not_authorized')) {
    return new AppError('forbidden', 'No tenés permiso para administrar pedidos.', {
      message: 'not_authorized',
    })
  }
  return new AppError('unknown', 'No se pudo actualizar el pedido. Intentá de nuevo.', {
    message: m.split(/[:\s]/)[0]?.slice(0, 64) || 'rpc_error',
    retryable: true,
  })
}
