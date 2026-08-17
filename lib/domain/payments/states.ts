export const PAYMENT_STATUSES = [
  'pending',
  'requires_review',
  'approved',
  'rejected',
  'cancelled',
  'expired',
  'partially_refunded',
  'refunded',
] as const

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_METHODS = ['mercado_pago', 'bank_transfer'] as const
export type PaymentMethodCode = (typeof PAYMENT_METHODS)[number]

export const TERMINAL_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'approved',
  'rejected',
  'cancelled',
  'expired',
  'refunded',
]

export const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  pending: ['requires_review', 'approved', 'rejected', 'cancelled', 'expired'],
  requires_review: ['approved', 'rejected', 'cancelled', 'expired'],
  approved: ['partially_refunded', 'refunded'],
  rejected: [],
  cancelled: [],
  expired: [],
  partially_refunded: ['partially_refunded', 'refunded'],
  refunded: [],
}

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === 'string' && (PAYMENT_STATUSES as readonly string[]).includes(value)
}

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to && from === 'partially_refunded') return true
  return (PAYMENT_TRANSITIONS[from] ?? []).includes(to)
}

export function paymentStatusLabel(status: PaymentStatus): string {
  switch (status) {
    case 'pending':
      return 'Pendiente de pago'
    case 'requires_review':
      return 'Comprobante en revisión'
    case 'approved':
      return 'Pagado'
    case 'rejected':
      return 'Rechazado'
    case 'cancelled':
      return 'Cancelado'
    case 'expired':
      return 'Vencido'
    case 'partially_refunded':
      return 'Reembolsado en parte'
    case 'refunded':
      return 'Reembolsado'
    default:
      return status
  }
}

export function paymentMethodLabel(method: PaymentMethodCode): string {
  return method === 'mercado_pago' ? 'Mercado Pago' : 'Transferencia bancaria'
}
