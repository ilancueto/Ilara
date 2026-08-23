import 'server-only'

import { createSupabaseServiceClient } from '@/lib/supabase/service'
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
  kind: OrderNotifyKind,
  providedLines?: Array<{ name: string; quantity: number }>
): Promise<boolean> {
  try {
    const number = orderNumber.trim()
    if (!number) return false
    const service = createSupabaseServiceClient()
    const { data, error } = await service
      .from('orders')
      .select('id, customer_email, customer_name, order_number, total, fulfillment_mode')
      .eq('order_number', number)
      .maybeSingle()
    if (error || !data) return false
    if (!isNotifyEmail(data.customer_email)) return false
    const followUrl = await createOrderNotificationUrl(data.order_number, kind)
    if (!followUrl) return false
    let lines = providedLines || []
    if (lines.length === 0) {
      const items = await service
        .from('order_items')
        .select('name_snapshot, quantity')
        .eq('order_id', data.id)
        .order('sort_order')
      if (!items.error) {
        lines = (items.data || []).map((item) => ({ name: item.name_snapshot, quantity: item.quantity }))
      }
    }
    return sendOrderCustomerEmail({
      customerName: data.customer_name,
      customerEmail: data.customer_email,
      orderNumber: data.order_number,
      total: Number(data.total) || 0,
      lines,
      fulfillmentMode: data.fulfillment_mode,
      followUrl,
      kind,
    })
  } catch {
    return false
  }
}

export async function sendOrderCustomerEmail(input: OrderNotifyInput): Promise<boolean> {
  const to = (input.customerEmail || '').trim()
  if (!isNotifyEmail(to)) return false
  const key = process.env.RESEND_API_KEY?.trim() || ''
  const from = process.env.ORDER_EMAIL_FROM?.trim() || ''
  if (key.length < 8 || !from.includes('@')) return false

  const mail = buildOrderCustomerEmail(input)
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `ilara-${input.orderNumber}-${input.kind || 'status'}`.slice(0, 256),
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      }),
      cache: 'no-store',
    })
    return response.ok
  } catch {
    return false
  }
}
