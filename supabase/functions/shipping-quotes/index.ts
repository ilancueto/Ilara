import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.2'

type JsonRecord = Record<string, unknown>

const ENVIA_RATE_URL = 'https://api.envia.com/ship/rate/'
const ENVIA_GEOCODE_URL = 'https://geocodes.envia.com/zipcode/AR'
const QUOTE_TTL_MS = 15 * 60 * 1000
const REQUEST_TIMEOUT_MS = 12_000
const MAX_QUOTES_PER_10_MINUTES = 12
const ARGENTINA_CARRIERS = [
  'andreani', 'correoArgentino', 'dhl', 'dpd', 'fedex', 'oca', 'rueddo', 'urbano', 'welivery',
]
const ALLOWED_ORIGINS = new Set([
  'https://ilara.com.ar',
  'https://www.ilara.com.ar',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
])

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://ilara.com.ar',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

function json(status: number, body: JsonRecord, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || 'unknown'
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function positiveMoney(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null
}

function geocodeLocation(value: unknown): { city: string; stateCode: string; stateName: string } | null {
  const root = asRecord(Array.isArray(value) ? value[0] : value)
  const legacy = asRecord(root.data)
  const state = asRecord(root.state)
  const stateCodes = asRecord(state.code)
  const city = text(legacy.city) || text(root.locality)
  const stateCode = text(legacy.state) || text(stateCodes['2digit'])
  const stateName = text(state.name) || stateCode
  return city && stateCode ? { city, stateCode, stateName } : null
}

async function enviaFetch(url: string, token: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new Error(`envia_http_${response.status}`)
    return payload
  } finally {
    clearTimeout(timeout)
  }
}

serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) })
  if (req.method !== 'POST') return json(405, { ok: false, code: 'method_not_allowed' }, origin)
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(403, { ok: false, code: 'origin_not_allowed' }, origin)

  const enviaToken = Deno.env.get('ENVIA_TOKEN')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!enviaToken || !supabaseUrl || !serviceKey) {
    console.error(JSON.stringify({ event: 'shipping_quote_config_error' }))
    return json(503, { ok: false, code: 'shipping_unavailable' }, origin)
  }

  try {
    const body = asRecord(await req.json())
    const postalCode = text(body.postalCode)
    if (!/^\d{4}$/.test(postalCode)) {
      return json(400, { ok: false, code: 'invalid_postal_code' }, origin)
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const ipHash = await sha256(clientIp(req))
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { count, error: countError } = await admin
      .from('shipping_quote_requests')
      .select('id', { count: 'exact', head: true })
      .eq('request_ip_hash', ipHash)
      .gte('created_at', since)
    if (countError) throw new Error('quote_rate_limit_check_failed')
    if ((count || 0) >= MAX_QUOTES_PER_10_MINUTES) {
      return json(429, { ok: false, code: 'rate_limited' }, origin)
    }
    const { error: requestInsertError } = await admin.from('shipping_quote_requests').insert({
      request_ip_hash: ipHash,
      destination_postal_code: postalCode,
    })
    if (requestInsertError) throw new Error('quote_rate_limit_record_failed')

    const geocodeRaw = await enviaFetch(`${ENVIA_GEOCODE_URL}/${postalCode}`, enviaToken)
    const destination = geocodeLocation(geocodeRaw)
    if (!destination) {
      console.warn(JSON.stringify({
        event: 'shipping_geocode_unrecognized',
        postalCode,
        responseType: Array.isArray(geocodeRaw) ? 'array' : typeof geocodeRaw,
        keys: Object.keys(asRecord(geocodeRaw)).slice(0, 12),
      }))
      return json(400, { ok: false, code: 'postal_code_not_found' }, origin)
    }

    const baseRatePayload = {
      origin: {
        name: 'Ilara', company: 'Ilara', phone: '2990000000', street: 'Neuquen',
        city: 'Neuquen', state: 'NQ', country: 'AR', postalCode: '8300',
      },
      destination: {
        name: 'Cliente Ilara', phone: '1100000000', street: 'A confirmar',
        city: destination.city, state: destination.stateCode, country: 'AR', postalCode,
      },
      packages: [{
        type: 'envelope', content: 'Cosmetica', amount: 1, declaredValue: 0,
        weight: 1, weightUnit: 'KG', lengthUnit: 'CM',
        dimensions: { length: 35, width: 20, height: 5 },
      }],
    }

    const carrierResponses = await Promise.all(ARGENTINA_CARRIERS.map(async (carrier) => {
      try {
        return asRecord(await enviaFetch(ENVIA_RATE_URL, enviaToken, {
          method: 'POST',
          body: JSON.stringify({ ...baseRatePayload, shipment: { type: 1, carrier } }),
        }))
      } catch {
        return {}
      }
    }))
    const rates = carrierResponses.flatMap((response) => Array.isArray(response.data) ? response.data : [])
    const normalized = rates.flatMap((entry) => {
      const rate = asRecord(entry)
      const amount = positiveMoney(rate.totalPrice)
      const currency = text(rate.currency).toUpperCase()
      const carrier = text(rate.carrier)
      const service = text(rate.service)
      if (!amount || currency !== 'ARS' || !carrier || !service) return []
      return [{
        carrier,
        carrier_description: text(rate.carrierDescription) || carrier,
        service,
        service_description: text(rate.serviceDescription) || service,
        delivery_estimate: text(rate.deliveryEstimate) || null,
        amount,
      }]
    }).sort((a, b) => a.amount - b.amount).slice(0, 8)

    if (normalized.length === 0) {
      console.warn(JSON.stringify({ event: 'shipping_quote_empty', postalCode }))
      return json(422, { ok: false, code: 'no_shipping_options' }, origin)
    }

    const quoteGroupId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + QUOTE_TTL_MS).toISOString()
    const rows = normalized.map((rate) => ({
      quote_group_id: quoteGroupId,
      provider: 'envia',
      destination_postal_code: postalCode,
      destination_city: destination.city,
      destination_state: destination.stateName,
      currency: 'ARS',
      request_ip_hash: ipHash,
      expires_at: expiresAt,
      ...rate,
    }))
    const { data: saved, error: insertError } = await admin
      .from('shipping_quotes')
      .insert(rows)
      .select('id, carrier_description, service_description, delivery_estimate, amount, currency')
    if (insertError || !saved) throw new Error('quote_persist_failed')

    console.log(JSON.stringify({ event: 'shipping_quote_succeeded', postalCode, optionCount: saved.length }))
    return json(200, {
      ok: true,
      destination: { postalCode, city: destination.city, state: destination.stateName },
      expiresAt,
      options: saved.map((option) => ({
        id: option.id,
        carrier: option.carrier_description,
        service: option.service_description,
        deliveryEstimate: option.delivery_estimate,
        amount: Number(option.amount),
        currency: option.currency,
      })),
    }, origin)
  } catch (error) {
    const code = error instanceof Error && error.name === 'AbortError'
      ? 'shipping_timeout'
      : error instanceof Error && error.message.startsWith('envia_http_')
      ? 'shipping_provider_error'
      : 'shipping_unavailable'
    console.error(JSON.stringify({ event: 'shipping_quote_failed', code }))
    return json(code === 'shipping_timeout' ? 504 : 502, { ok: false, code }, origin)
  }
})
