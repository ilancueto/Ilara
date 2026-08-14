import type { RefundMethod, ReturnableSaleItem } from './types'

export const REFUND_METHODS: RefundMethod[] = [
  'efectivo',
  'transferencia',
  'tarjeta',
  'mercadopago',
  'credito_cancelado',
  'otro',
]

export function refundMethodLabel(method: RefundMethod): string {
  const labels: Record<RefundMethod, string> = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    tarjeta: 'Tarjeta',
    mercadopago: 'Mercado Pago',
    credito_cancelado: 'Cancelar saldo a crédito',
    otro: 'Otro',
  }
  return labels[method]
}

/** Preview solamente. PostgreSQL recalcula el monto autoritativo. */
export function previewRefundAmount(item: ReturnableSaleItem, quantity: number): number {
  if (quantity <= 0 || item.quantity <= 0) return 0
  const q = Math.min(quantity, item.available_quantity)
  return Math.round((item.subtotal * q * 100) / item.quantity) / 100
}

export function creditNoteLabel(number: number): string {
  return `NC-${String(number).padStart(6, '0')}`
}
