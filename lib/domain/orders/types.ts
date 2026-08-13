/**
 * Tipos de dominio de pedidos de catálogo (Stage 6.1).
 * Sin columnas internas de productos (purchase_price, min_stock, notes).
 */
import type { OrderStatus } from '@/lib/domain/orders/states'

export type OrderLineType = 'product' | 'combo'

export type OrderChannel = 'catalog'

export type ComboComponentSnapshot = {
  product_id: number
  product_name: string
  quantity: number
}

/** Línea de input del cliente (sin precios). */
export type CreateOrderLineInput = {
  line_type: OrderLineType
  product_id?: number
  combo_id?: number
  quantity: number
}

/** Contacto mínimo del checkout. */
export type CreateOrderCustomerInput = {
  customer_name: string
  customer_phone: string
  customer_email?: string | null
  notes?: string | null
}

export type CreateOrderInput = CreateOrderCustomerInput & {
  idempotency_key: string
  lines: CreateOrderLineInput[]
  coupon_code?: string | null
}

/** Resultado público de creación (sin PII extra). */
export type CreateOrderResult = {
  order_id: string
  order_number: string
  status: OrderStatus
  subtotal: number
  discount_total: number
  total: number
  created_at: string
  idempotent_replay: boolean
}

export type OrderListItem = {
  id: string
  order_number: string
  status: OrderStatus
  channel: OrderChannel
  customer_name: string
  customer_phone: string
  customer_email: string | null
  notes: string | null
  subtotal: number
  discount_total: number
  total: number
  coupon_code: string | null
  coupon_discount_percentage: number | null
  stock_reserved: boolean
  created_at: string
  updated_at: string
  confirmed_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
}

export type OrderItemRow = {
  id: number
  order_id: string
  line_type: OrderLineType
  product_id: number | null
  combo_id: number | null
  name_snapshot: string
  variant_snapshot: string | null
  combo_components_snapshot: ComboComponentSnapshot[]
  quantity: number
  unit_price: number
  discount_percentage: number
  line_subtotal: number
  sort_order: number
}

export type OrderStatusEvent = {
  id: number
  order_id: string
  from_status: OrderStatus | null
  to_status: OrderStatus
  actor_user_id: string | null
  actor_kind: 'system' | 'admin' | 'public'
  reason: string | null
  created_at: string
}

export type OrderDetail = OrderListItem & {
  items: OrderItemRow[]
  events: OrderStatusEvent[]
}

export type TransitionOrderResult = {
  order_id: string
  order_number: string
  status: OrderStatus
  from_status?: OrderStatus
  stock_reserved: boolean
  idempotent_replay: boolean
}
