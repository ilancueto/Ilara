/**
 * Mensaje de WhatsApp post-pedido (sin tokens, sin IDs internos).
 */
import { formatPesoARExact } from '@/lib/formatPesoAR'

export type WhatsAppOrderSummaryLine = {
  name: string
  quantity: number
}

export function buildOrderWhatsAppMessage(input: {
  order_number: string
  total: number
  lines: WhatsAppOrderSummaryLine[]
  customer_name?: string
  fulfillment_mode?: string | null
}): string {
  const name = (input.customer_name || '').trim()
  const greeting = name ? `¡Hola! Soy ${name}.` : '¡Hola!'
  const items = input.lines.slice(0, 20).map((l) => `• ${l.name} x${l.quantity}`)
  const more =
    input.lines.length > 20 ? [`… y ${input.lines.length - 20} ítem(s) más`] : []
  const fulfillment =
    input.fulfillment_mode === 'retiro'
      ? 'Lo retiro en el local.'
      : input.fulfillment_mode === 'coordinar'
        ? 'Quiero coordinar la entrega por acá.'
        : 'Es con envío a domicilio.'

  return [
    greeting,
    `Acabo de registrar el pedido *${input.order_number}* en Ilara.`,
    fulfillment,
    '',
    ...items,
    ...more,
    '',
    `Total: $${formatPesoARExact(input.total)}`,
    '',
    '¿Me ayudan a coordinar?',
  ].join('\n')
}

export function buildTransferWhatsAppMessage(input: {
  order_number: string
  amount: number
}): string {
  return [
    '¡Hola! Quiero pagar por transferencia.',
    `Pedido *${input.order_number}*`,
    `Total: $${formatPesoARExact(input.amount)}`,
    '',
    '¿Me pasan alias o CBU?',
  ].join('\n')
}
