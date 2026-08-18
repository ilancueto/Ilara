import type { PaymentStatus } from '@/lib/domain/payments/states'

/** Estados de Mercado Pago que nos importan. El resto queda pendiente o se ignora. */
export function mapMercadoPagoStatus(status: string | null | undefined): PaymentStatus | 'ignore' {
  switch (String(status || '').toLowerCase()) {
    case 'approved':
      return 'approved'
    case 'rejected':
      return 'rejected'
    case 'cancelled':
      return 'cancelled'
    case 'refunded':
      return 'refunded'
    case 'charged_back':
      return 'ignore'
    case 'in_process':
    case 'pending':
    case 'authorized':
    case 'in_mediation':
      return 'pending'
    default:
      return 'ignore'
  }
}

export function extractMpFeeAndNet(payment: Record<string, unknown>): {
  actualFee: number | null
  netReceived: number | null
} {
  const details = payment.transaction_details
  const net =
    details && typeof details === 'object' && !Array.isArray(details)
      ? Number((details as Record<string, unknown>).net_received_amount)
      : NaN
  const fees = Array.isArray(payment.fee_details) ? payment.fee_details : []
  const feeSum = fees.reduce((acc, row) => {
    if (!row || typeof row !== 'object') return acc
    const amount = Number((row as Record<string, unknown>).amount)
    return Number.isFinite(amount) ? acc + amount : acc
  }, 0)
  return {
    actualFee: fees.length > 0 && Number.isFinite(feeSum) ? Number(feeSum.toFixed(2)) : null,
    netReceived: Number.isFinite(net) ? net : null,
  }
}
