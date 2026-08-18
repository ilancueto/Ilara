import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.2'

type JsonRecord = Record<string, unknown>

const ALLOWED_ORIGINS = new Set([
  'https://ilara.com.ar',
  'https://www.ilara.com.ar',
  'https://ilarabeauty.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
])
const VERCEL_APP_ORIGIN = /^https:\/\/ilara(?:-[a-z0-9-]+)?-ilara\.vercel\.app$/
const MP_PREFERENCES = 'https://api.mercadopago.com/checkout/preferences'

function isAllowedOrigin(origin: string | null): origin is string {
  return Boolean(origin && (ALLOWED_ORIGINS.has(origin) || VERCEL_APP_ORIGIN.test(origin)))
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : 'https://ilara.com.ar',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  }
}

function json(status: number, body: JsonRecord, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function siteUrl(): string {
  return (Deno.env.get('SITE_URL') || 'https://ilara.com.ar').replace(/\/$/, '')
}

function supabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL') || ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

serve(async (req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) })
  if (req.method !== 'POST') return json(405, { ok: false }, origin)

  const token = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')?.trim() || ''
  if (token.length < 16) return json(503, { ok: false, code: 'payments_disabled' }, origin)

  let body: JsonRecord = {}
  try {
    body = asRecord(await req.json())
  } catch {
    return json(400, { ok: false }, origin)
  }
  const access = String(body.access_capability || '').trim()
  const follow = String(body.follow_token || '').trim()
  const orderNumber = String(body.order_number || '').trim()
  const idempotency = String(body.idempotency_key || '').trim()
  const usingFollow = access.length < 32 && follow.length >= 32 && orderNumber.length >= 8
  if (access.length < 32 && !usingFollow) return json(401, { ok: false }, origin)

  const startPayload = usingFollow
    ? { follow_token: follow, order_number: orderNumber, method: 'mercado_pago', idempotency_key: idempotency }
    : { access_capability: access, method: 'mercado_pago', idempotency_key: idempotency }
  const attachAuth = usingFollow
    ? { follow_token: follow, order_number: orderNumber }
    : { access_capability: access }

  const admin = supabaseAdmin()
  async function preferenceContext() {
    if (usingFollow) {
      return admin.rpc('mp_preference_context_follow', {
        p_order_number: orderNumber,
        p_follow_token: follow,
      })
    }
    return admin.rpc('mp_preference_context', { p_access_capability: access })
  }

  if (!idempotency || idempotency.length < 16) {
    const existing = await preferenceContext()
    if (existing.error) return json(400, { ok: false, code: 'invalid_access_capability' }, origin)
    const row = asRecord(existing.data)
    if (row.checkout_url) return json(200, { ok: true, checkout_url: row.checkout_url }, origin)
    return json(400, { ok: false, code: 'invalid_idempotency_key' }, origin)
  }

  const started = await admin.rpc('start_catalog_order_payment', {
    p_payload: startPayload,
  })
  if (started.error) {
    const message = started.error.message || ''
    if (message.includes('payments_disabled') || message.includes('method_disabled')) {
      return json(409, { ok: false, code: 'payments_disabled' }, origin)
    }
    if (message.includes('invalid_access_capability') || message.includes('invalid_follow_token')) {
      return json(401, { ok: false }, origin)
    }
    return json(400, { ok: false }, origin)
  }

  const ctx = await preferenceContext()
  if (ctx.error) return json(400, { ok: false }, origin)
  const pay = asRecord(ctx.data)
  if (pay.checkout_url) return json(200, { ok: true, checkout_url: pay.checkout_url }, origin)

  const base = siteUrl()
  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '')
  const expiresAt = String(pay.expires_at || '')
  const returnUrl = usingFollow
    ? `${base}/pedido/${encodeURIComponent(String(pay.order_number || orderNumber))}`
    : `${base}/pedido`
  const preferenceBody = {
    items: [
      {
        title: `Pedido ${String(pay.order_number || '')}`.slice(0, 80),
        quantity: 1,
        currency_id: 'ARS',
        unit_price: Number(pay.amount_due),
      },
    ],
    external_reference: String(pay.external_reference || pay.payment_id || ''),
    notification_url: `${supabaseUrl}/functions/v1/payments-mp-webhook`,
    back_urls: {
      success: returnUrl,
      pending: returnUrl,
      failure: returnUrl,
    },
    auto_return: 'approved',
    expires: true,
    expiration_date_to: expiresAt || undefined,
  }

  const created = await fetch(MP_PREFERENCES, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': String(pay.idempotency_key || idempotency).slice(0, 150),
    },
    body: JSON.stringify(preferenceBody),
  })
  const createdJson = asRecord(await created.json().catch(() => ({})))
  if (!created.ok) return json(502, { ok: false }, origin)

  const isSandbox = token.startsWith('TEST-')
  const checkout = String(
    isSandbox
      ? (createdJson.sandbox_init_point || createdJson.init_point || '')
      : (createdJson.init_point || createdJson.sandbox_init_point || '')
  )
  const preferenceId = String(createdJson.id || '')
  if (!checkout.startsWith('https://') || !preferenceId) return json(502, { ok: false }, origin)

  const attached = await admin.rpc('attach_mp_preference', {
    p_payload: {
      ...attachAuth,
      preference_id: preferenceId,
      checkout_url: checkout,
    },
  })
  if (attached.error) return json(400, { ok: false }, origin)
  return json(200, { ok: true, checkout_url: checkout }, origin)
})
