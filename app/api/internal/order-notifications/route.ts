import { authorizeInternalJob, cronUnauthorizedResponse } from '@/lib/security/cronAuth'
import { dispatchOrderNotifications } from '@/lib/domain/orders/notificationOutbox'

export const maxDuration = 60

export async function POST(request: Request) {
  if (!authorizeInternalJob(request)) return cronUnauthorizedResponse()
  try {
    const result = await dispatchOrderNotifications()
    return Response.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ ok: false, code: 'notification_worker_unavailable' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    })
  }
}
