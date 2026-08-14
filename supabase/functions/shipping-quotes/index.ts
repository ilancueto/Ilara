import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.112.2'

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
  lat: number
  lon: number
  postalCode: string
}

const ENVIA_RATE_URL = 'https://api.envia.com/ship/rate/'
const ENVIA_GEOCODE_URL = 'https://geocodes.envia.com/zipcode/AR'
const GEOREF_BASE_URL = 'https://apis.datos.gob.ar/georef/api/v2.0'
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'
const QUOTE_TTL_MS = 15 * 60 * 1000
const REQUEST_TIMEOUT_MS = 12_000
const GEOCODE_CACHE_MS = 30 * 24 * 60 * 60 * 1000
const LOCATIONS_CACHE_MS = 24 * 60 * 60 * 1000
const MAX_QUOTES_PER_10_MINUTES = 12
const ARGENTINA_CARRIERS = [
  'andreani', 'correoArgentino', 'dhl', 'dpd', 'fedex', 'oca', 'rueddo', 'urbano', 'welivery',
]
const ALLOWED_ORIGINS = new Set([
  'https://ilara.com.ar',
  'https://www.ilara.com.ar',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3010',
  'http://127.0.0.1:3010',
])

let provincesCache: { expiresAt: number; data: LocationItem[] } | null = null
const localitiesCache = new Map<string, { expiresAt: number; data: LocationItem[] }>()

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

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function positiveMoney(value: unknown): number | null {
  const parsed = finiteNumber(value)
  return parsed !== null && parsed > 0 ? Math.round(parsed * 100) / 100 : null
}

function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function numericPostalCode(value: unknown): string | null {
  const match = text(value).toUpperCase().match(/(?:^|[A-Z])(\d{4})(?:[A-Z]{3})?$/)
  return match?.[1] || null
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
  return asRecord(await fetchJson(`${GEOREF_BASE_URL}/${path}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  }))
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

async function normalizeOfficialAddress(
  provinceId: string,
  localityName: string,
  streetInput: string,
  numberInput: string,
) {
  const payload = await georefFetch('direcciones', new URLSearchParams({
    direccion: `${streetInput} ${numberInput}`,
    provincia: provinceId,
    localidad: localityName,
    max: '1',
  }))
  const raw = Array.isArray(payload.direcciones) ? asRecord(payload.direcciones[0]) : {}
  const street = text(asRecord(raw.calle).nombre)
  const number = String(asRecord(raw.altura).valor || '').trim()
  const location = asRecord(raw.ubicacion)
  const lat = finiteNumber(location.lat)
  const lon = finiteNumber(location.lon)
  if (!street || number !== String(Number(numberInput)) || lat === null || lon === null) {
    throw new Error('address_not_found')
  }
  return { street, number, lat, lon }
}

async function resolvePostalCode(
  admin: SupabaseClient,
  provinceName: string,
  localityName: string,
  street: string,
  number: string,
): Promise<string> {
  const queryKey = normalizeSearch(`${provinceName}|${localityName}|${street}|${number}`)
  const queryHash = await sha256(`ar|${queryKey}`)
  const freshSince = new Date(Date.now() - GEOCODE_CACHE_MS).toISOString()
  const { data: cached, error: cacheError } = await admin
    .from('shipping_geocode_cache')
    .select('postal_code')
    .eq('query_hash', queryHash)
    .gte('updated_at', freshSince)
    .maybeSingle()
  if (cacheError) throw new Error('geocode_cache_read_failed')
  if (cached?.postal_code) return cached.postal_code

  const { error: slotError } = await admin.rpc('acquire_shipping_geocode_slot')
  if (slotError) throw new Error('geocode_slot_failed')

  const params = new URLSearchParams({
    format: 'jsonv2',
    street: `${number} ${street}`,
    city: localityName,
    state: provinceName,
    country: 'Argentina',
    countrycodes: 'ar',
    addressdetails: '1',
    limit: '3',
  })
  const raw = await fetchJson(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, {
    headers: {
      'User-Agent': 'IlaraBeauty/1.0 (https://ilara.com.ar)',
      'Referer': 'https://ilara.com.ar/',
      'Accept-Language': 'es-AR,es;q=0.9',
    },
  })
  const postalCode = (Array.isArray(raw) ? raw : []).flatMap((value) => {
    const address = asRecord(asRecord(value).address)
    if (text(address.country_code).toLowerCase() !== 'ar') return []
    const code = numericPostalCode(address.postcode)
    return code ? [code] : []
  })[0]
  if (!postalCode) throw new Error('postal_code_not_found')

  const { error: upsertError } = await admin.from('shipping_geocode_cache').upsert({
    query_hash: queryHash,
    postal_code: postalCode,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'query_hash' })
  if (upsertError) throw new Error('geocode_cache_write_failed')
  return postalCode
}

async function resolveStructuredAddress(
  admin: SupabaseClient,
  body: JsonRecord,
): Promise<StructuredAddress> {
  const provinceId = text(body.provinceId)
  const localityId = text(body.localityId)
  const streetInput = text(body.street)
  const numberInput = text(body.number)
  if (streetInput.length < 2 || streetInput.length > 120) throw new Error('invalid_street')
  if (!/^\d{1,6}$/.test(numberInput) || Number(numberInput) < 1) throw new Error('invalid_street_number')

  const { locality, provinceName } = await resolveOfficialLocality(provinceId, localityId)
  const normalized = await normalizeOfficialAddress(
    provinceId, locality.name, streetInput, numberInput,
  )
  const postalCode = await resolvePostalCode(
    admin, provinceName, locality.name, normalized.street, normalized.number,
  )
  return {
    provinceId,
    provinceName,
    localityId,
    localityName: locality.name,
    street: normalized.street,
    number: normalized.number,
    formattedAddress: `${normalized.street} ${normalized.number}, ${locality.name}, ${provinceName}`,
    lat: normalized.lat,
    lon: normalized.lon,
    postalCode,
  }
}

serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) })
  if (req.method !== 'POST') return json(405, { ok: false, code: 'method_not_allowed' }, origin)
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(403, { ok: false, code: 'origin_not_allowed' }, origin)

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

    const address = await resolveStructuredAddress(admin, body)
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
      'invalid_province', 'invalid_locality', 'invalid_street', 'invalid_street_number',
      'address_not_found', 'postal_code_not_found',
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
