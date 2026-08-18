export type RefundMethod =
  | 'efectivo'
  | 'transferencia'
  | 'tarjeta'
  | 'mercadopago'
  | 'credito_cancelado'
  | 'otro'

export type ReturnableSaleItem = {
  id: number
  product_id: number | null
  combo_id: number | null
  product_name: string
  quantity: number
  returned_quantity: number
  available_quantity: number
  unit_price: number
  subtotal: number
}

export type ReturnableSale = {
  id: number
  sale_date: string
  created_at: string
  customer_name: string | null
  total: number
  status: string
  payment_method: string | null
  items: ReturnableSaleItem[]
  available_total: number
}

export type SaleReturnListItem = {
  id: string
  credit_note_number: number
  sale_id: number
  reason: string
  refund_method: RefundMethod
  refund_total: number
  restock: boolean
  created_at: string
  customer_name: string | null
  items: Array<{
    id: number
    sale_item_id: number
    product_name: string
    quantity: number
    refund_amount: number
  }>
}

export type CreateSaleReturnInput = {
  saleId: number
  reason: string
  refundMethod: RefundMethod
  restock: boolean
  lines: Array<{ saleItemId: number; quantity: number }>
  idempotencyKey: string
}

export type CreateSaleReturnResult = {
  id: string
  credit_note_number: number
  sale_id: number
  refund_total: number
  restock: boolean
  idempotent_replay: boolean
}

export type CatalogRefundAction = 'none' | 'record_manual' | 'request_mp'

export type ReturnableOrderItem = {
  id: number
  product_id: number | null
  combo_id: number | null
  product_name: string
  quantity: number
  returned_quantity: number
  available_quantity: number
  unit_price: number
  subtotal: number
}

export type ReturnableOrder = {
  id: string
  order_number: string
  created_at: string
  customer_name: string | null
  customer_id: number | null
  total: number
  status: string
  stock_reserved: boolean
  items: ReturnableOrderItem[]
  available_total: number
}

export type OrderReturnListItem = {
  id: string
  return_number: number
  order_id: string
  order_number: string | null
  reason: string
  refund_action: CatalogRefundAction
  refund_total: number
  restock: boolean
  created_at: string
  customer_name: string | null
  items: Array<{
    id: number
    order_item_id: number
    product_name: string
    quantity: number
    refund_amount: number
  }>
}

export type CreateOrderReturnInput = {
  orderId: string
  reason: string
  refundAction: CatalogRefundAction
  restock: boolean
  orderPaymentId?: string | null
  lines: Array<{ orderItemId: number; quantity: number }>
  idempotencyKey: string
}

export type CreateOrderReturnResult = {
  id: string
  return_number: number
  order_id: string
  refund_total: number
  restock: boolean
  refund_action: CatalogRefundAction
  idempotent_replay: boolean
}
