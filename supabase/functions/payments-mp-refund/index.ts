import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.2'

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function json(status: number, body: JsonRecord): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (req.method !== 'POST') return json(405, { ok: false })

  const auth = req.headers.get('authorization') || ''
  if (!auth.toLowerCase().startsWith('bearer ')) return json(401, { ok: false })

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_ANON_KEY') || '',
    { global: { headers: { Authorization: auth } }, auth: { persistSession: false, autoRefreshToken: false } }
  )
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  let body: JsonRecord = {}
  try {
    body = asRecord(await req.json())
  } catch {
    return json(400, { ok: false })
  }
  const paymentId = String(body.payment_id || '').trim()
  const reason = String(body.reason || '').trim()
  const amount = body.amount == null ? null : Number(body.amount)
  if (!paymentId || reason.length < 3) return json(400, { ok: false })

  const { data: authData } = await userClient.auth.getUser()
  if (!authData.user) return json(401, { ok: false })
  const role = await admin.from('user_roles').select('role').eq('user_id', authData.user.id).maybeSingle()
  if (role.data?.role !== 'admin') return json(403, { ok: false })

  const pay = await admin
    .from('order_payments')
    .select('id, provider, provider_payment_id, status, amount_due, refunded_amount')
    .eq('id', paymentId)
    .maybeSingle()
  if (!pay.data || !['approved', 'partially_refunded'].includes(String(pay.data.status))) {
    return json(400, { ok: false })
  }

  const token = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')?.trim() || ''
  if (pay.data.provider === 'mercado_pago') {
    const providerPaymentId = String(pay.data.provider_payment_id || '')
    if (!providerPaymentId || token.length < 16) return json(409, { ok: false })
    const refunded = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(providerPaymentId)}/refunds`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `refund:${paymentId}:${amount == null ? 'full' : String(amount)}`,
      },
      body: JSON.stringify(amount == null ? {} : { amount }),
    })
    if (!refunded.ok) return json(502, { ok: false })
  }

  const recorded = await userClient.rpc('admin_refund_catalog_payment', {
    p_payment_id: paymentId,
    p_amount: amount,
    p_reason: reason,
  })
  if (recorded.error) return json(400, { ok: false })
  return json(200, { ok: true, status: asRecord(recorded.data).status })
})
