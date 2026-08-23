import { formatPesoARExact } from '@/lib/formatPesoAR'
import { FULFILLMENT_COPY, type FulfillmentMode } from '@/lib/domain/orders/fulfillment'

export type OrderNotifyLine = {
  name: string
  quantity: number
}

export type OrderNotifyKind =
  | 'created'
  | 'payment_pending'
  | 'payment_received'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled'

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

const KIND_COPY: Record<OrderNotifyKind, { subject: string; lead: string; next: string }> = {
  created: {
    subject: 'Recibimos tu pedido',
    lead: 'Recibimos tu pedido',
    next: 'Podés elegir cómo pagarlo y seguir cada novedad desde el enlace seguro.',
  },
  payment_pending: {
    subject: 'Recibimos el pago de tu pedido',
    lead: 'Recibimos el pago de tu pedido',
    next: 'Lo estamos confirmando. Te avisamos cuando quede listo.',
  },
  payment_received: {
    subject: 'Pago acreditado de tu pedido',
    lead: 'Acreditamos el pago de tu pedido',
    next: 'Ya estamos con tu pedido. Te avisamos cada novedad.',
  },
  confirmed: {
    subject: 'Confirmamos tu pedido',
    lead: 'Confirmamos tu pedido',
    next: 'El siguiente paso es prepararlo. Te avisamos cuando avance.',
  },
  preparing: {
    subject: 'Estamos preparando tu pedido',
    lead: 'Estamos preparando tu pedido',
    next: 'Te avisamos cuando esté listo.',
  },
  ready: {
    subject: 'Tu pedido está listo',
    lead: 'Tu pedido está listo',
    next: 'Ya podés coordinar la entrega o el retiro.',
  },
  completed: {
    subject: 'Entregamos tu pedido',
    lead: 'Entregamos tu pedido',
    next: 'Gracias por elegir Ilara Beauty.',
  },
  cancelled: {
    subject: 'Cancelamos tu pedido',
    lead: 'Cancelamos tu pedido',
    next: 'Si no fue lo que esperabas, respondé este mail y lo vemos.',
  },
}

export function notifyKindFromOrderStatus(status: string): OrderNotifyKind | null {
  if (status === 'confirmed') return 'confirmed'
  if (status === 'preparing') return 'preparing'
  if (status === 'ready') return 'ready'
  if (status === 'completed') return 'completed'
  if (status === 'cancelled') return 'cancelled'
  return null
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
  const kind = input.kind || 'payment_pending'
  const copy = KIND_COPY[kind]
  const fulfillment = orderNotifyFulfillment(input.fulfillmentMode)
  const statusLine = input.followUrl
    ? `Podés ver el estado acá: ${input.followUrl}`
    : 'Si tenés el enlace de seguimiento, usalo para ver el pedido.'

  const text = [
    `Hola ${name},`,
    '',
    `${copy.lead} ${input.orderNumber} en Ilara Beauty.`,
    copy.next,
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
      <p>${escapeHtml(copy.lead)} <strong>${escapeHtml(input.orderNumber)}</strong> en Ilara Beauty.</p>
      <p>${escapeHtml(copy.next)}</p>
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
    subject: `${copy.subject} ${input.orderNumber}`,
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
