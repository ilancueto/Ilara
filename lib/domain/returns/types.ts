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
