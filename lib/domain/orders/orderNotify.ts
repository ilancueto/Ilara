import { formatPesoARExact } from '@/lib/formatPesoAR'
import { FULFILLMENT_COPY, type FulfillmentMode } from '@/lib/domain/orders/fulfillment'

export type OrderNotifyLine = {
  name: string
  quantity: number
}

export type OrderNotifyKind = 'payment_pending'

export type OrderNotifyInput = {
  customerName: string
  customerEmail?: string | null
  orderNumber: string
  total: number
  lines: OrderNotifyLine[]
  fulfillmentMode?: FulfillmentMode | string | null
  followUrl: string | null
  kind?: OrderNotifyKind
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
  const statusLine = input.followUrl
    ? `Podés ver el estado acá: ${input.followUrl}`
    : 'Te vamos a confirmar el pedido cuando revisemos el pago.'

  const text = [
    `Hola ${name},`,
    '',
    `Recibimos el pago de tu pedido ${input.orderNumber} en Ilara Beauty.`,
    'Lo estamos confirmando. Te avisamos cuando quede listo.',
    fulfillment,
    '',
    ...items,
    ...more,
    '',
    `Total: $${formatPesoARExact(input.total)}`,
    '',
    statusLine,
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
      <p>Recibimos el pago de tu pedido <strong>${escapeHtml(input.orderNumber)}</strong> en Ilara Beauty.</p>
      <p>Lo estamos confirmando. Te avisamos cuando quede listo.</p>
      <p>${escapeHtml(fulfillment)}</p>
      <ul>${itemHtml}</ul>
      <p><strong>Total: $${escapeHtml(formatPesoARExact(input.total))}</strong></p>
      ${
        input.followUrl
          ? `<p><a href="${escapeHtml(input.followUrl)}" style="color:#B85D6F">Ver el estado del pedido</a></p>`
          : '<p>Te vamos a confirmar el pedido cuando revisemos el pago.</p>'
      }
      <p>Si tenés alguna consulta, respondé este mail o escribinos por WhatsApp.</p>
      <p>Ilara Beauty</p>
    </div>
  `.trim()

  return {
    subject: `Recibimos el pago de tu pedido ${input.orderNumber}`,
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
