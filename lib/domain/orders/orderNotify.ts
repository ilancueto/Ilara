import { formatPesoARExact } from '@/lib/formatPesoAR'
import { FULFILLMENT_COPY, type FulfillmentMode } from '@/lib/domain/orders/fulfillment'

export type OrderNotifyLine = {
  name: string
  quantity: number
}

export type OrderNotifyInput = {
  customerName: string
  customerEmail?: string | null
  orderNumber: string
  total: number
  lines: OrderNotifyLine[]
  fulfillmentMode?: FulfillmentMode | string | null
  followUrl: string | null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isNotifyEmail(value: string | null | undefined): boolean {
  const email = (value || '').trim()
  return email.length >= 6 && email.length <= 120 && EMAIL_RE.test(email)
}

export function orderNotifyFulfillment(mode?: string | null): string {
  if (mode === 'retiro') return FULFILLMENT_COPY.retiro.success
  if (mode === 'coordinar') return FULFILLMENT_COPY.coordinar.success
  return FULFILLMENT_COPY.envio.success
}

export function buildOrderCustomerEmail(input: OrderNotifyInput): {
  subject: string
  text: string
  html: string
} {
  const name = input.customerName.trim() || 'hola'
  const items = input.lines
    .slice(0, 20)
    .map((line) => `• ${line.name} x${line.quantity}`)
  const more =
    input.lines.length > 20 ? [`… y ${input.lines.length - 20} ítem(s) más`] : []
  const fulfillment = orderNotifyFulfillment(input.fulfillmentMode)
  const payLine = input.followUrl
    ? `Para ver el estado y pagar: ${input.followUrl}`
    : 'Te escribimos para coordinar el pago.'

  const text = [
    `Hola ${name},`,
    '',
    `Recibimos tu pedido ${input.orderNumber} en Ilara Beauty.`,
    fulfillment,
    '',
    ...items,
    ...more,
    '',
    `Total: $${formatPesoARExact(input.total)}`,
    '',
    payLine,
    '',
    'Si tenés alguna consulta, respondé este mail o escribinos por WhatsApp.',
    '',
    'Ilara Beauty',
  ].join('\n')

  const itemHtml = input.lines
    .slice(0, 20)
    .map(
      (line) =>
        `<li>${escapeHtml(line.name)} ×${line.quantity}</li>`
    )
    .join('')

  const html = `
    <div style="font-family:Outfit,Arial,sans-serif;color:#1A181E;line-height:1.5">
      <p>Hola ${escapeHtml(name)},</p>
      <p>Recibimos tu pedido <strong>${escapeHtml(input.orderNumber)}</strong> en Ilara Beauty.</p>
      <p>${escapeHtml(fulfillment)}</p>
      <ul>${itemHtml}</ul>
      <p><strong>Total: $${escapeHtml(formatPesoARExact(input.total))}</strong></p>
      ${
        input.followUrl
          ? `<p><a href="${escapeHtml(input.followUrl)}" style="color:#B85D6F">Ver el pedido y pagar</a></p>`
          : '<p>Te escribimos para coordinar el pago.</p>'
      }
      <p>Si tenés alguna consulta, respondé este mail o escribinos por WhatsApp.</p>
      <p>Ilara Beauty</p>
    </div>
  `.trim()

  return {
    subject: `Tu pedido ${input.orderNumber} en Ilara`,
    text,
    html,
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
