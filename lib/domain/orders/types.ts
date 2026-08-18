/**
 * Tipos de dominio de pedidos de catálogo (Stage 6.1).
 * Sin columnas internas de productos (purchase_price, min_stock, notes).
 */
import type { FulfillmentMode } from '@/lib/domain/orders/fulfillment'
import type { OrderStatus } from '@/lib/domain/orders/states'

export type { FulfillmentMode }

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
  fulfillment_mode?: FulfillmentMode
  shipping_quote_id?: string | null
  fulfillment_zone?: string | null
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
  fulfillment_mode: FulfillmentMode
  shipping_amount: number
  shipping_currency: string
  shipping_carrier: string
  shipping_service: string
  shipping_delivery_estimate: string | null
  shipping_destination_postal_code: string
  shipping_destination_city: string
  shipping_destination_state: string
  shipping_destination_formatted_address: string | null
  total: number
  created_at: string
  idempotent_replay: boolean
  /** Clave de seguimiento. Solo se entrega desde el Server Action, nunca se guarda en claro. */
  access_capability?: string
}

export type OrderReturnSummary = {
  id: string
  return_number: number
  reason: string
  refund_action: 'none' | 'record_manual' | 'request_mp'
  refund_total: number
  restock: boolean
  created_at: string
}

export type OrderListItem = {
  id: string
  order_number: string
  status: OrderStatus
  channel: OrderChannel
  customer_id: number | null
  customer_name: string
  customer_phone: string
  customer_email: string | null
  notes: string | null
  subtotal: number
  discount_total: number
  fulfillment_mode: FulfillmentMode
  shipping_quote_id: string | null
  shipping_provider: string | null
  shipping_carrier: string | null
  shipping_carrier_description: string | null
  shipping_service: string | null
  shipping_service_description: string | null
  shipping_delivery_estimate: string | null
  shipping_amount: number
  shipping_currency: string | null
  shipping_destination_postal_code: string | null
  shipping_destination_city: string | null
  shipping_destination_state: string | null
  shipping_destination_province_id: string | null
  shipping_destination_locality_id: string | null
  shipping_destination_street: string | null
  shipping_destination_number: string | null
  shipping_destination_formatted_address: string | null
  shipping_destination_lat: number | null
  shipping_destination_lon: number | null
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
  returns: OrderReturnSummary[]
}

export type TransitionOrderResult = {
  order_id: string
  order_number: string
  status: OrderStatus
  from_status?: OrderStatus
  stock_reserved: boolean
  idempotent_replay: boolean
}
