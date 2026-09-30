import 'server-only'

import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { logStructured } from '@/lib/observability/logger'
import { buildOrderNotificationUrl } from '@/lib/domain/orders/followLink'
import {
  buildOrderCustomerEmail,
  isNotifyEmail,
  type OrderNotifyInput,
  type OrderNotifyKind,
} from '@/lib/domain/orders/orderNotify'

export async function notifyPaymentPendingByOrderNumber(
  orderNumber: string
): Promise<boolean> {
  return notifyOrderCustomer(orderNumber, 'payment_pending')
}

export async function createOrderNotificationUrl(
  orderNumber: string,
  kind: string
): Promise<string | null> {
  const service = createSupabaseServiceClient()
  const issued = await service.rpc('create_order_notification_link', {
    p_order_number: orderNumber.trim(),
    p_kind: kind.slice(0, 48),
  })
  if (issued.error || !issued.data || typeof issued.data !== 'object') return null
  const token = String((issued.data as Record<string, unknown>).token || '')
  return token.length >= 32 ? buildOrderNotificationUrl(orderNumber, token) : null
}

export async function notifyOrderCustomer(
  orderNumber: string,
  kind: OrderNotifyKind
): Promise<boolean> {
  try {
    const number = orderNumber.trim()
    if (!number) return false
    const service = createSupabaseServiceClient()
    const { data, error } = await service
      .from('orders')
      .select('id, status, customer_email, customer_name, order_number, total, fulfillment_mode')
      .eq('order_number', number)
      .maybeSingle()
    if (error || !data) return false
    if (['confirmed', 'preparing', 'ready', 'completed', 'cancelled'].includes(kind) && data.status !== kind) return false
    if (!isNotifyEmail(data.customer_email)) return false
    const { dispatchOrderNotifications } = await import('./notificationOutbox')
    return (await dispatchOrderNotifications(data.id, kind)).sent > 0
  } catch {
    return false
  }
}

export function prepareOrderCustomerEmail(input: OrderNotifyInput): string {
  const mail = buildOrderCustomerEmail(input)
  return JSON.stringify({ from: process.env.ORDER_EMAIL_FROM?.trim() || '', to: [(input.customerEmail || '').trim()], subject: mail.subject, text: mail.text, html: mail.html })
}

export async function sendOrderCustomerEmail(input: OrderNotifyInput, deliveryId?: string, preparedBody?: string): Promise<boolean> {
  const to = (input.customerEmail || '').trim()
  if (!isNotifyEmail(to)) return false
  const key = process.env.RESEND_API_KEY?.trim() || ''
  const from = process.env.ORDER_EMAIL_FROM?.trim() || ''
  if (key.length < 8 || !from.includes('@')) {
    logStructured({ event: 'order_notification_failed', level: 'warn', code: 'email_not_configured' })
    return false
  }

  const body = preparedBody || prepareOrderCustomerEmail(input)
  const deadline = Date.now() + 8_000
  for (let attempt = 0; attempt < 3; attempt++) {
    let retryDelay = 250 * (2 ** attempt)
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': (deliveryId ? `ilara-outbox-${deliveryId}` : `ilara-${input.orderNumber}-${input.kind || 'status'}`).slice(0, 256),
        },
        body,
        cache: 'no-store',
        signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
      })
      if (response.ok) return true
      const retryable = response.status === 429 || response.status >= 500
      const retryAfter = response.headers.get('retry-after')
      if (retryAfter) {
        const seconds = Number(retryAfter)
        const waitMs = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now()
        if (Number.isFinite(waitMs)) retryDelay = Math.max(retryDelay, waitMs)
      }
      if (!retryable || attempt === 2 || Date.now() + retryDelay >= deadline) {
        logStructured({ event: 'order_notification_failed', level: 'warn', status: response.status })
        return false
      }
    } catch {
      if (attempt === 2 || Date.now() + retryDelay >= deadline) {
        logStructured({ event: 'order_notification_failed', level: 'warn', code: 'email_unavailable' })
        return false
      }
    }
    await new Promise(resolve => setTimeout(resolve, retryDelay))
  }
  return false
}
