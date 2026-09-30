import { authorizeInternalJob, cronUnauthorizedResponse } from '@/lib/security/cronAuth'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export async function GET(request: Request) {
  if (!authorizeInternalJob(request)) return cronUnauthorizedResponse()
  try {
    const client = createSupabaseServiceClient()
    const deadline = new Date(Date.now() - 30 * 60_000).toISOString()
    const [failed, stale] = await Promise.all([
      client.from('order_notification_outbox').select('id', { count: 'exact', head: true }).eq('state', 'failed'),
      client.from('order_notification_outbox').select('id', { count: 'exact', head: true })
        .in('state', ['pending', 'processing']).lt('created_at', deadline),
    ])
    if (failed.error || stale.error) throw new Error('outbox_unavailable')
    const configured = Boolean(process.env.RESEND_API_KEY?.trim() && process.env.ORDER_EMAIL_FROM?.includes('@'))
    const ok = configured && failed.count === 0 && stale.count === 0
    return Response.json({ ok, emailConfigured: configured, failed: failed.count, stale: stale.count }, {
      status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return Response.json({ ok: false, code: 'operations_unavailable' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    })
  }
}
