import 'server-only'

import { buildOrderCustomerEmail, isNotifyEmail, type OrderNotifyInput } from '@/lib/domain/orders/orderNotify'

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
