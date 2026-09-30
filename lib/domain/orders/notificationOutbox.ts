import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { createOrderNotificationUrl, prepareOrderCustomerEmail, sendOrderCustomerEmail } from './sendOrderEmail'
import { isNotifyEmail, type OrderNotifyInput, type OrderNotifyKind } from './orderNotify'

type Payload = OrderNotifyInput & { preparedBody: string }
type Job = { id: string; order_id: string; kind: OrderNotifyKind; lease_token: string; payload: Payload | null }

async function finish(client: SupabaseClient, job: Job, state: string, code?: string) {
  const result = await client.rpc('finish_order_notification', {
    p_id: job.id, p_lease: job.lease_token, p_state: state, p_code: code || null,
  })
  if (result.error || result.data !== true) throw new Error('notification_lease_lost')
}

async function deliver(client: SupabaseClient, job: Job): Promise<boolean> {
  try {
    let payload = job.payload
    if (!payload) {
      const order = await client.from('orders')
        .select('customer_name,customer_email,order_number,total,fulfillment_mode').eq('id', job.order_id).single()
      if (order.error) throw new Error('notification_order_unavailable')
      if (!isNotifyEmail(order.data.customer_email)) {
        await finish(client, job, 'skipped', 'no_customer_email')
        return false
      }
      const items = await client.from('order_items').select('name_snapshot,quantity').eq('order_id', job.order_id).order('sort_order')
      if (items.error) throw new Error('notification_items_unavailable')
      const followUrl = await createOrderNotificationUrl(order.data.order_number, job.kind)
      if (!followUrl) throw new Error('notification_link_unavailable')
      const input: OrderNotifyInput = {
        customerName: order.data.customer_name, customerEmail: order.data.customer_email,
        orderNumber: order.data.order_number, total: Number(order.data.total),
        fulfillmentMode: order.data.fulfillment_mode, followUrl, kind: job.kind,
        lines: items.data.map(item => ({ name: item.name_snapshot, quantity: item.quantity })),
      }
      // Includes sender and template version, so configuration changes cannot alter retries.
      payload = { ...input, preparedBody: prepareOrderCustomerEmail(input) }
      // Persist the exact input before contacting Resend; retry uses the same body and key.
      const saved = await client.from('order_notification_outbox').update({ payload })
        .eq('id', job.id).eq('lease_token', job.lease_token).eq('state', 'processing').select('id')
      if (saved.error || saved.data?.length !== 1) throw new Error('notification_lease_lost')
    }
    const sent = await sendOrderCustomerEmail(payload, job.id, payload.preparedBody)
    await finish(client, job, sent ? 'sent' : 'pending', sent ? undefined : 'provider_unavailable')
    return sent
  } catch {
    // No provider response, customer data, token or raw exception in logs or the job result.
    await finish(client, job, 'pending', 'delivery_unavailable')
    return false
  }
}

export async function dispatchOrderNotifications(orderId?: string, kind?: OrderNotifyKind) {
  if (!process.env.RESEND_API_KEY?.trim() || !process.env.ORDER_EMAIL_FROM?.includes('@')) {
    throw new Error('notification_email_not_configured')
  }
  const client = createSupabaseServiceClient()
  const claimed = await client.rpc('claim_order_notifications', {
    p_limit: orderId ? 1 : 3, p_order_id: orderId || null, p_kind: kind || null,
  })
  if (claimed.error) throw new Error('notification_claim_failed')
  const jobs = (claimed.data || []) as Job[]
  let sent = 0
  for (const job of jobs) if (await deliver(client, job)) sent++
  return { claimed: jobs.length, sent }
}
