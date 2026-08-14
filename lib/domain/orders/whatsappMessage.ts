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
}): string {
  const name = (input.customer_name || '').trim()
  const greeting = name ? `¡Hola! Soy ${name}.` : '¡Hola!'
  const items = input.lines.slice(0, 20).map((l) => `• ${l.name} x${l.quantity}`)
  const more =
    input.lines.length > 20 ? [`… y ${input.lines.length - 20} ítem(s) más`] : []

  return [
    greeting,
    `Acabo de registrar el pedido *${input.order_number}* en Ilara.`,
    '',
    ...items,
    ...more,
    '',
    `Total: $${formatPesoARExact(input.total)}`,
    '',
    '¿Me ayudan a coordinar la entrega o el retiro?',
  ].join('\n')
}
