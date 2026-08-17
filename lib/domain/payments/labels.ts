/**
 * Copy pública de pagos. Prohibido filtrar jerga interna.
 */
export const PUBLIC_PAYMENT_COPY = {
  mercadoPago: 'Mercado Pago',
  bankTransfer: 'Transferencia bancaria',
  payingByTransfer: 'pagando por transferencia bancaria',
  youSave: 'Ahorrás',
  choosePayment: 'Elegí cómo pagar',
  transferInstructions: 'Transferí el total a la cuenta indicada y, si te lo pedimos, adjuntá el comprobante.',
  paymentPendingReview: 'Recibimos tu comprobante. Te vamos a confirmar el pedido cuando lo revisemos.',
  paymentRejected: 'No pudimos confirmar el pago. Podés intentar de nuevo o elegir otro medio.',
  paymentExpired: 'El tiempo para pagar se venció. Armá el pedido de nuevo si todavía lo querés.',
  returnInformative:
    'Si ya pagaste, el pedido se confirma solo cuando el cobro queda acreditado. Esta pantalla no es un comprobante.',
} as const

export const INTERNAL_WORDS_FORBIDDEN_IN_PUBLIC_UI = [
  'fee',
  'gross-up',
  'pricing version',
  'webhook',
  'provider',
  'init_point',
  'sandbox',
  'effective_fee_rate',
  'token',
  'cron',
  'localidades',
  'feature flag',
  'access_capability',
  'order_id',
  'rpc',
] as const

export function bankTransferSecondaryLine(formattedBase: string): string {
  return `$${formattedBase} ${PUBLIC_PAYMENT_COPY.payingByTransfer}`
}
