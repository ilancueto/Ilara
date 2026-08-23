import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.2'

type JsonRecord = Record<string, unknown>
type LocationItem = { id: string; name: string; department?: string }
type StructuredAddress = {
  provinceId: string
  provinceName: string
  localityId: string
  localityName: string
  street: string
  number: string
  formattedAddress: string
  lat: number | null
  lon: number | null
  postalCode: string
}

const ENVIA_RATE_URL = 'https://api.envia.com/ship/rate/'
const ENVIA_GEOCODE_URL = 'https://geocodes.envia.com/zipcode/AR'
const GEOREF_BASE_URLS = [
  'https://apis.datos.gob.ar/georef/api/v2.0',
  // El endpoint sin versión sigue siendo oficial y funciona como respaldo
  // durante caídas transitorias de v2 (observado en producción el 2026-08-23).
  'https://apis.datos.gob.ar/georef/api',
] as const
const QUOTE_TTL_MS = 15 * 60 * 1000
const REQUEST_TIMEOUT_MS = 12_000
const LOCATIONS_CACHE_MS = 24 * 60 * 60 * 1000
const MAX_QUOTES_PER_10_MINUTES = 12
const ARGENTINA_CARRIERS = ['oca', 'andreani', 'correoArgentino'] as const
const CARRIER_LABELS: Record<(typeof ARGENTINA_CARRIERS)[number], string> = {
  oca: 'OCA',
  andreani: 'Andreani',
  correoArgentino: 'Correo Argentino',
}
const ALLOWED_ORIGINS = new Set([
  'https://ilara.com.ar',
  'https://www.ilara.com.ar',
  'https://ilarabeauty.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3010',
  'http://127.0.0.1:3010',
])
const VERCEL_APP_ORIGIN = /^https:\/\/ilara(?:-[a-z0-9-]+)?-ilara\.vercel\.app$/

let provincesCache: { expiresAt: number; data: LocationItem[] } | null = null
const localitiesCache = new Map<string, { expiresAt: number; data: LocationItem[] }>()

function isAllowedOrigin(origin: string | null): origin is string {
  return Boolean(origin && (ALLOWED_ORIGINS.has(origin) || VERCEL_APP_ORIGIN.test(origin)))
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : 'https://ilara.com.ar',
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

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function positiveMoney(value: unknown): number | null {
  const parsed = finiteNumber(value)
  return parsed !== null && parsed > 0 ? Math.round(parsed * 100) / 100 : null
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

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const payload = await response.json().catch(() => null)
    if (!response.ok) throw new Error(`http_${response.status}`)
    return payload
  } finally {
    clearTimeout(timeout)
  }
}

async function enviaFetch(url: string, token: string, init?: RequestInit): Promise<unknown> {
  try {
    return await fetchJson(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('http_')) {
      throw new Error(`envia_${error.message}`)
    }
    throw error
  }
}

async function georefFetch(path: string, params: URLSearchParams): Promise<JsonRecord> {
  let lastError: unknown
  for (const baseUrl of GEOREF_BASE_URLS) {
    try {
      return asRecord(await fetchJson(`${baseUrl}/${path}?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      }))
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('georef_unavailable')
}

function parseLocations(value: unknown, key: 'provincias' | 'localidades'): LocationItem[] {
  const items = asRecord(value)[key]
  if (!Array.isArray(items)) return []
  return items.flatMap((value) => {
    const item = asRecord(value)
    const id = text(item.id)
    const name = text(item.nombre)
    const department = text(asRecord(item.departamento).nombre)
    if (!id || !name) return []
    return [{ id, name, ...(department ? { department } : {}) }]
  })
}

async function listProvinces(): Promise<LocationItem[]> {
  if (provincesCache && provincesCache.expiresAt > Date.now()) return provincesCache.data
  const payload = await georefFetch('provincias', new URLSearchParams({
    campos: 'id,nombre', orden: 'nombre', max: '24',
  }))
  const data = parseLocations(payload, 'provincias')
  if (data.length !== 24) throw new Error('georef_provinces_unrecognized')
  provincesCache = { expiresAt: Date.now() + LOCATIONS_CACHE_MS, data }
  return data
}

async function listLocalities(provinceId: string): Promise<LocationItem[]> {
  if (!/^\d{2}$/.test(provinceId)) throw new Error('invalid_province')
  const cached = localitiesCache.get(provinceId)
  if (cached && cached.expiresAt > Date.now()) return cached.data
  const payload = await georefFetch('localidades', new URLSearchParams({
    provincia: provinceId,
    campos: 'id,nombre,departamento,provincia',
    orden: 'nombre',
    max: '5000',
  }))
  const data = parseLocations(payload, 'localidades')
  if (!data.length) throw new Error('georef_localities_unrecognized')
  localitiesCache.set(provinceId, { expiresAt: Date.now() + LOCATIONS_CACHE_MS, data })
  return data
}

async function resolveOfficialLocality(provinceId: string, localityId: string) {
  if (!/^\d{2}$/.test(provinceId)) throw new Error('invalid_province')
  if (!/^\d{8}$/.test(localityId)) throw new Error('invalid_locality')
  const payload = await georefFetch('localidades', new URLSearchParams({
    id: localityId,
    provincia: provinceId,
    campos: 'id,nombre,departamento,provincia',
    max: '1',
  }))
  const locality = parseLocations(payload, 'localidades')[0]
  const raw = Array.isArray(payload.localidades) ? asRecord(payload.localidades[0]) : {}
  const province = asRecord(raw.provincia)
  if (!locality || locality.id !== localityId || text(province.id) !== provinceId) {
    throw new Error('invalid_locality')
  }
  return { locality, provinceName: text(province.nombre) }
}

async function resolveStructuredAddress(
  body: JsonRecord,
): Promise<StructuredAddress> {
  const provinceId = text(body.provinceId)
  const localityId = text(body.localityId)
  const postalCode = text(body.postalCode)
  const streetInput = text(body.street)
  const numberInput = text(body.number)
  if (!/^\d{4}$/.test(postalCode)) throw new Error('invalid_postal_code')
  if (streetInput.length < 2 || streetInput.length > 120) throw new Error('invalid_street')
  if (!/^\d{1,6}$/.test(numberInput) || Number(numberInput) < 1) throw new Error('invalid_street_number')

  const { locality, provinceName } = await resolveOfficialLocality(provinceId, localityId)
  const street = streetInput.replace(/\s+/g, ' ')
  const number = String(Number(numberInput))
  return {
    provinceId,
    provinceName,
    localityId,
    localityName: locality.name,
    street,
    number,
    formattedAddress: `${street} ${number}, ${locality.name}, ${provinceName}`,
    lat: null,
    lon: null,
    postalCode,
  }
}

serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) })
  if (req.method !== 'POST') return json(405, { ok: false, code: 'method_not_allowed' }, origin)
  if (origin && !isAllowedOrigin(origin)) return json(403, { ok: false, code: 'origin_not_allowed' }, origin)

  try {
    const body = asRecord(await req.json())
    const action = text(body.action) || 'quote'

    if (action === 'provinces') {
      return json(200, { ok: true, provinces: await listProvinces() }, origin)
    }
    if (action === 'localities') {
      return json(200, { ok: true, localities: await listLocalities(text(body.provinceId)) }, origin)
    }
    if (action !== 'quote') return json(400, { ok: false, code: 'invalid_action' }, origin)

    const enviaToken = Deno.env.get('ENVIA_TOKEN')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!enviaToken || !supabaseUrl || !serviceKey) {
      console.error(JSON.stringify({ event: 'shipping_quote_config_error' }))
      return json(503, { ok: false, code: 'shipping_unavailable' }, origin)
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
    const { data: requestRow, error: requestInsertError } = await admin
      .from('shipping_quote_requests')
      .insert({ request_ip_hash: ipHash, destination_postal_code: null })
      .select('id')
      .single()
    if (requestInsertError || !requestRow) throw new Error('quote_rate_limit_record_failed')

    const address = await resolveStructuredAddress(body)
    const { error: requestUpdateError } = await admin
      .from('shipping_quote_requests')
      .update({ destination_postal_code: address.postalCode })
      .eq('id', requestRow.id)
    if (requestUpdateError) throw new Error('quote_rate_limit_update_failed')

    const geocodeRaw = await enviaFetch(`${ENVIA_GEOCODE_URL}/${address.postalCode}`, enviaToken)
    const enviaDestination = geocodeLocation(geocodeRaw)
    if (!enviaDestination) {
      console.warn(JSON.stringify({ event: 'shipping_geocode_unrecognized', postalCode: address.postalCode }))
      return json(400, { ok: false, code: 'postal_code_not_found' }, origin)
    }

    const baseRatePayload = {
      origin: {
        name: 'Ilara', company: 'Ilara', phone: '2990000000', street: 'Neuquen',
        city: 'Neuquen', state: 'NQ', country: 'AR', postalCode: '8300',
      },
      destination: {
        name: 'Cliente Ilara', phone: '1100000000', street: address.street,
        number: address.number, city: enviaDestination.city, state: enviaDestination.stateCode,
        country: 'AR', postalCode: address.postalCode,
      },
      packages: [{
        type: 'envelope', content: 'Cosmetica', amount: 1, declaredValue: 0,
        weight: 1, weightUnit: 'KG', lengthUnit: 'CM',
        dimensions: { length: 35, width: 20, height: 5 },
      }],
    }

    const carrierResponses = await Promise.all(ARGENTINA_CARRIERS.map(async (requestedCarrier) => {
      try {
        const response = asRecord(await enviaFetch(ENVIA_RATE_URL, enviaToken, {
          method: 'POST',
          body: JSON.stringify({ ...baseRatePayload, shipment: { type: 1, carrier: requestedCarrier } }),
        }))
        return {
          requestedCarrier,
          rates: Array.isArray(response.data) ? response.data : [],
        }
      } catch {
        return { requestedCarrier, rates: [] }
      }
    }))
    const rates = carrierResponses.flatMap(({ requestedCarrier, rates: carrierRates }) => (
      carrierRates.map((entry) => ({ entry, requestedCarrier }))
    ))
    const rankedRates = rates.flatMap(({ entry, requestedCarrier }) => {
      const rate = asRecord(entry)
      const amount = positiveMoney(rate.totalPrice)
      const currency = text(rate.currency).toUpperCase()
      const carrier = text(rate.carrier)
      const service = text(rate.service)
      if (!amount || currency !== 'ARS' || !carrier || !service) return []
      return [{
        requested_carrier: requestedCarrier,
        carrier,
        carrier_description: CARRIER_LABELS[requestedCarrier],
        service,
        service_description: text(rate.serviceDescription) || service,
        delivery_estimate: text(rate.deliveryEstimate) || null,
        amount,
      }]
    }).sort((a, b) => a.amount - b.amount)

    const isBranchDelivery = (rate: (typeof rankedRates)[number]) => {
      const label = `${rate.service} ${rate.service_description}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()

      return /sucursal|punto (?:de )?retiro|retiro en (?:agencia|punto)|pickup|pick up|branch|office|ocurre/.test(label)
    }

    const normalized = ARGENTINA_CARRIERS.flatMap((requestedCarrier) => {
      const carrierRates = rankedRates.filter((rate) => rate.requested_carrier === requestedCarrier)
      const cheapestHome = carrierRates.find((rate) => !isBranchDelivery(rate))
      const cheapestBranch = carrierRates.find(isBranchDelivery)

      return [
        cheapestHome
          ? { ...cheapestHome, service_description: 'Entrega a domicilio' }
          : null,
        cheapestBranch
          ? { ...cheapestBranch, service_description: 'Retiro en sucursal' }
          : null,
      ].flatMap((rate) => {
        if (!rate) return []
        return [{
          carrier: rate.carrier,
          carrier_description: rate.carrier_description,
          service: rate.service,
          service_description: rate.service_description,
          delivery_estimate: rate.delivery_estimate,
          amount: rate.amount,
        }]
      })
    })

    if (normalized.length === 0) {
      console.warn(JSON.stringify({ event: 'shipping_quote_empty', postalCode: address.postalCode }))
      return json(422, { ok: false, code: 'no_shipping_options' }, origin)
    }

    const quoteGroupId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + QUOTE_TTL_MS).toISOString()
    const rows = normalized.map((rate) => ({
      quote_group_id: quoteGroupId,
      provider: 'envia',
      destination_postal_code: address.postalCode,
      destination_city: address.localityName,
      destination_state: address.provinceName,
      destination_province_id: address.provinceId,
      destination_locality_id: address.localityId,
      destination_street: address.street,
      destination_number: address.number,
      destination_formatted_address: address.formattedAddress,
      destination_lat: address.lat,
      destination_lon: address.lon,
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

    console.log(JSON.stringify({
      event: 'shipping_quote_succeeded',
      postalCode: address.postalCode,
      optionCount: saved.length,
    }))
    return json(200, {
      ok: true,
      destination: {
        postalCode: address.postalCode,
        city: address.localityName,
        state: address.provinceName,
        street: address.street,
        number: address.number,
        formattedAddress: address.formattedAddress,
      },
      expiresAt,
      options: saved.map((option) => ({
        id: option.id,
        carrier: option.carrier_description,
        service: option.service_description,
        deliveryEstimate: option.delivery_estimate,
        amount: Number(option.amount),
        currency: option.currency,
      })),
      attribution: 'Georef Argentina · © OpenStreetMap contributors',
    }, origin)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const validationCodes = new Set([
      'invalid_province', 'invalid_locality', 'invalid_postal_code',
      'invalid_street', 'invalid_street_number', 'postal_code_not_found',
    ])
    const code = error instanceof Error && error.name === 'AbortError'
      ? 'shipping_timeout'
      : validationCodes.has(message)
      ? message
      : message.startsWith('envia_http_')
      ? 'shipping_provider_error'
      : 'shipping_unavailable'
    const status = code === 'shipping_timeout' ? 504 : validationCodes.has(code) ? 400 : 502
    console.error(JSON.stringify({ event: 'shipping_quote_failed', code }))
    return json(status, { ok: false, code }, origin)
  }
})
