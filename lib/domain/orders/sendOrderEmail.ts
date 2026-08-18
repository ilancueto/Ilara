import 'server-only'

import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { buildOrderFollowUrl } from '@/lib/domain/orders/followLink'
import { buildOrderCustomerEmail, isNotifyEmail, type OrderNotifyInput } from '@/lib/domain/orders/orderNotify'

export async function notifyPaymentPendingByOrderNumber(
  orderNumber: string,
  followToken?: string | null
): Promise<boolean> {
  try {
    const number = orderNumber.trim()
    if (!number) return false
    const service = createSupabaseServiceClient()
    const { data, error } = await service
      .from('orders')
      .select('customer_email, customer_name, order_number, total, fulfillment_mode')
      .eq('order_number', number)
      .maybeSingle()
    if (error || !data) return false
    return sendOrderCustomerEmail({
      customerName: data.customer_name,
      customerEmail: data.customer_email,
      orderNumber: data.order_number,
      total: Number(data.total) || 0,
      lines: [],
      fulfillmentMode: data.fulfillment_mode,
      followUrl: followToken ? buildOrderFollowUrl(data.order_number, followToken) : null,
      kind: 'payment_pending',
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
