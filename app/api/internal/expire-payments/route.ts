import { authorizeInternalJob, cronUnauthorizedResponse } from '@/lib/security/cronAuth'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { logStructured } from '@/lib/observability/logger'
import { ObservabilityEvent } from '@/lib/observability/events'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function runExpire() {
  const supabase = createSupabaseServiceClient()
  const stale = await supabase
    .from('payment_receipt_uploads')
    .select('id, storage_path')
    .is('completed_at', null)
    .lt('expires_at', new Date().toISOString())
    .limit(500)
  if (stale.error) {
    return Response.json({ ok: false }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
  const stalePaths = (stale.data || []).map((row) => row.storage_path)
  if (stalePaths.length > 0) {
    const removed = await supabase.storage.from('payment-receipts').remove(stalePaths)
    if (removed.error) {
      return Response.json({ ok: false }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
    }
    const deleted = await supabase
      .from('payment_receipt_uploads')
      .delete()
      .in('id', (stale.data || []).map((row) => row.id))
    if (deleted.error) {
      return Response.json({ ok: false }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
    }
  }
  const { data, error } = await supabase.rpc('expire_catalog_payments')
  if (error) {
    return Response.json({ ok: false }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
  const row = data && typeof data === 'object' ? data as { expired?: number; finished_at?: string } : {}
  logStructured({
    event: ObservabilityEvent.PAYMENT_EXPIRE_RUN,
    level: 'info',
    route: '/api/internal/expire-payments',
    meta: { expired: Number(row.expired) || 0 },
  })
  return Response.json(
    {
      ok: true,
      expired: Number(row.expired) || 0,
      abandoned_uploads_removed: stalePaths.length,
      ran_at: row.finished_at || new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function GET(request: Request) {
  if (!authorizeInternalJob(request)) return cronUnauthorizedResponse()
  return runExpire()
}

export async function POST(request: Request) {
  if (!authorizeInternalJob(request)) return cronUnauthorizedResponse()
  return runExpire()
}
