'use client'

import { getBrowserSupabase } from '@/lib/supabase/browser'
import { AppError } from '@/lib/domain/errors'
import type {
  ShippingAddressInput,
  ShippingLocation,
  ShippingOption,
  ShippingQuote,
} from '@/lib/domain/shipping/types'

const ERROR_MESSAGES: Record<string, string> = {
  invalid_province: 'Elegí una provincia válida.',
  invalid_locality: 'Elegí una ciudad o localidad válida.',
  invalid_postal_code: 'Ingresá un código postal válido de 4 números.',
  invalid_street: 'Ingresá una calle válida.',
  invalid_street_number: 'Ingresá una altura válida.',
  postal_code_not_found: 'No encontramos ese código postal. Revisalo e intentá de nuevo.',
  no_shipping_options: 'No hay opciones de envío disponibles para ese código postal.',
  rate_limited: 'Hiciste varias cotizaciones. Esperá unos minutos e intentá de nuevo.',
  shipping_timeout: 'La cotización demoró demasiado. Intentá de nuevo.',
  shipping_provider_error: 'No pudimos mostrar opciones de envío. Intentá de nuevo.',
  shipping_unavailable: 'No pudimos mostrar opciones de envío. Intentá de nuevo.',
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function shippingError(code: string): AppError {
  const validation = [
    'invalid_province', 'invalid_locality', 'invalid_postal_code', 'invalid_street',
    'invalid_street_number', 'postal_code_not_found', 'rate_limited',
  ].includes(code)
  return new AppError(validation ? 'validation' : 'unknown', ERROR_MESSAGES[code] || ERROR_MESSAGES.shipping_unavailable, {
    message: code,
    retryable: ![
      'invalid_province', 'invalid_locality', 'invalid_postal_code',
      'invalid_street', 'invalid_street_number',
    ].includes(code),
  })
}

async function invokeShipping(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await getBrowserSupabase().functions.invoke('shipping-quotes', { body })
  let payload = record(data)
  const context = record(error).context
  if (error && context instanceof Response) {
    payload = record(await context.clone().json().catch(() => null))
  }
  if (error || payload.ok !== true) {
    const code = typeof payload.code === 'string' ? payload.code : 'shipping_unavailable'
    throw shippingError(code)
  }
  return payload
}

function parseLocations(value: unknown): ShippingLocation[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const location = record(item)
    if (typeof location.id !== 'string' || typeof location.name !== 'string') return []
    return [{
      id: location.id,
      name: location.name,
      ...(typeof location.department === 'string' ? { department: location.department } : {}),
    }]
  })
}

export async function listShippingProvinces(): Promise<ShippingLocation[]> {
  const payload = await invokeShipping({ action: 'provinces' })
  const provinces = parseLocations(payload.provinces)
  if (!provinces.length) throw shippingError('shipping_unavailable')
  return provinces
}

export async function listShippingLocalities(provinceId: string): Promise<ShippingLocation[]> {
  if (!/^\d{2}$/.test(provinceId)) throw shippingError('invalid_province')
  const payload = await invokeShipping({ action: 'localities', provinceId })
  const localities = parseLocations(payload.localities)
  if (!localities.length) throw shippingError('shipping_unavailable')
  return localities
}

export async function quoteShipping(input: ShippingAddressInput): Promise<ShippingQuote> {
  const provinceId = input.provinceId.trim()
  const localityId = input.localityId.trim()
  const postalCode = input.postalCode.trim()
  const street = input.street.trim()
  const number = input.number.trim()
  if (!/^\d{2}$/.test(provinceId)) throw shippingError('invalid_province')
  if (!/^\d{8}$/.test(localityId)) throw shippingError('invalid_locality')
  if (!/^\d{4}$/.test(postalCode)) throw shippingError('invalid_postal_code')
  if (street.length < 2 || street.length > 120) throw shippingError('invalid_street')
  if (!/^\d{1,6}$/.test(number) || Number(number) < 1) throw shippingError('invalid_street_number')

  const payload = await invokeShipping({
    action: 'quote', provinceId, localityId, postalCode, street, number,
  })

  const destination = record(payload.destination)
  const options = (Array.isArray(payload.options) ? payload.options : []).flatMap((value) => {
    const option = record(value)
    const amount = Number(option.amount)
    if (
      typeof option.id !== 'string'
      || typeof option.carrier !== 'string'
      || typeof option.service !== 'string'
      || !Number.isFinite(amount)
      || amount <= 0
      || option.currency !== 'ARS'
    ) return []
    return [{
      id: option.id,
      carrier: option.carrier,
      service: option.service,
      deliveryEstimate: typeof option.deliveryEstimate === 'string' ? option.deliveryEstimate : null,
      amount,
      currency: 'ARS' as const,
    } satisfies ShippingOption]
  })
  if (!options.length) {
    throw new AppError('unknown', ERROR_MESSAGES.no_shipping_options, {
      message: 'no_shipping_options', retryable: true,
    })
  }
  return {
    destination: {
      postalCode: String(destination.postalCode || ''),
      city: String(destination.city || ''),
      state: String(destination.state || ''),
      street: String(destination.street || ''),
      number: String(destination.number || ''),
      formattedAddress: String(destination.formattedAddress || ''),
    },
    expiresAt: String(payload.expiresAt || ''),
    options,
  }
}
