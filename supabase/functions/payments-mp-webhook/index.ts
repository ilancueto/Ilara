import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.2'

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function parseSignature(header: string | null): { ts: string; v1: string } | null {
  if (!header) return null
  const parts: Record<string, string> = {}
  for (const chunk of header.split(',')) {
    const idx = chunk.indexOf('=')
    if (idx === -1) continue
    parts[chunk.slice(0, idx).trim()] = chunk.slice(idx + 1).trim()
  }
  if (!parts.ts || !parts.v1) return null
  return { ts: parts.ts, v1: parts.v1 }
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(signed), (b) => b.toString(16).padStart(2, '0')).join('')
}

function safeEqual(a: string, b: string): boolean {
  const left = a.toLowerCase()
  const right = b.toLowerCase()
  if (left.length !== right.length || left.length === 0) return false
  let diff = 0
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i)
  return diff === 0
}

async function verifySignature(req: Request, dataId: string, secret: string): Promise<boolean> {
  const parsed = parseSignature(req.headers.get('x-signature'))
  const requestId = req.headers.get('x-request-id') || ''
  if (!parsed || !dataId || !requestId || secret.length < 16) return false
  const tsMs = Number(parsed.ts) * 1000
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 300_000) return false
  const expected = await hmacHex(secret, `id:${dataId};request-id:${requestId};ts:${parsed.ts};`)
  return safeEqual(expected, parsed.v1)
}

function feeAndNet(payment: JsonRecord): { actual_fee: number | null; net_received: number | null } {
  const details = asRecord(payment.transaction_details)
  const net = Number(details.net_received_amount)
  const fees = Array.isArray(payment.fee_details) ? payment.fee_details : []
  const feeSum = fees.reduce((acc, row) => {
    const amount = Number(asRecord(row).amount)
    return Number.isFinite(amount) ? acc + amount : acc
  }, 0)
  return {
    actual_fee: fees.length > 0 ? Number(feeSum.toFixed(2)) : null,
    net_received: Number.isFinite(net) ? net : null,
  }
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(null, { status: 405, headers: { 'Cache-Control': 'no-store' } })
  }
  const secret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET')?.trim() || ''
  const token = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')?.trim() || ''
  if (secret.length < 16 || token.length < 16) {
    console.error('payments_mp_webhook_not_configured')
    return new Response(JSON.stringify({ ok: false, code: 'mp_not_configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }
  const url = new URL(req.url)
  let body: JsonRecord = {}
  try {
    body = asRecord(await req.json())
  } catch {
    body = {}
  }
  const dataId = String(url.searchParams.get('data.id') || asRecord(body.data).id || body.id || '').trim()
  if (!(await verifySignature(req, dataId, secret))) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }

  const topic = String(url.searchParams.get('type') || body.type || body.topic || '')
  if (topic && !/payment/i.test(topic)) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }

  const fetched = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!fetched.ok) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }
  const payment = asRecord(await fetched.json())
  const money = feeAndNet(payment)
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const eventId = `${req.headers.get('x-request-id') || 'mp'}:${dataId}`
  const applied = await admin.rpc('apply_mercado_pago_payment', {
    p_payload: {
      provider_payment_id: String(payment.id || dataId),
      external_reference: String(payment.external_reference || ''),
      provider_status: String(payment.status || ''),
      transaction_amount: payment.transaction_amount,
      currency_id: String(payment.currency_id || ''),
      collector_id: payment.collector_id == null ? null : String(payment.collector_id),
      actual_fee: money.actual_fee,
      net_received: money.net_received,
      event_id: eventId,
    },
  })
  if (applied.error) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }
  const appliedRow = asRecord(applied.data)
  if (appliedRow.result !== 'duplicate' && appliedRow.status === 'approved') {
    await notifyCustomerPayment(admin, String(appliedRow.payment_id || ''))
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
})

async function notifyCustomerPayment(
  admin: ReturnType<typeof createClient>,
  paymentId: string
): Promise<void> {
  if (!paymentId) return
  const key = (Deno.env.get('RESEND_API_KEY') || '').trim()
  const from = (Deno.env.get('ORDER_EMAIL_FROM') || '').trim()
  if (key.length < 8 || !from.includes('@')) return
  const pay = await admin.from('order_payments').select('order_id').eq('id', paymentId).maybeSingle()
  const orderId = String(pay.data?.order_id || '')
  if (!orderId) return
  const order = await admin
    .from('orders')
    .select('customer_email, customer_name, order_number, total')
    .eq('id', orderId)
    .maybeSingle()
  const to = String(order.data?.customer_email || '').trim()
  const number = String(order.data?.order_number || '').trim()
  if (!to.includes('@') || !number) return
  const name = String(order.data?.customer_name || '').trim() || 'hola'
  const site = (Deno.env.get('SITE_URL') || 'https://ilara.com.ar').replace(/\/$/, '')
  const issued = await admin.rpc('create_order_notification_link', {
    p_order_number: number,
    p_kind: 'payment_received',
  })
  const issuedData = asRecord(issued.data)
  const notificationToken = String(issuedData.token || '')
  if (issued.error || notificationToken.length < 32) return
  const follow = `${site}/pedido/${encodeURIComponent(number)}?n=${encodeURIComponent(notificationToken)}`
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `ilara-${number}-payment_received`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Pago acreditado de tu pedido ${number}`,
      text: [
        `Hola ${name},`,
        '',
        `Acreditamos el pago de tu pedido ${number} en Ilara Beauty.`,
        'Ya estamos con tu pedido. Te avisamos cada novedad.',
        '',
        `Total: $${order.data?.total ?? ''}`,
        `Podés ver el estado acá: ${follow}`,
        '',
        'Ilara Beauty',
      ].join('\n'),
    }),
  }).catch(() => undefined)
}
