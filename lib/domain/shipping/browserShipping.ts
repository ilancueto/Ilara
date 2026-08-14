'use client'

import { getBrowserSupabase } from '@/lib/supabase/browser'
import { AppError } from '@/lib/domain/errors'
import type { ShippingOption, ShippingQuote } from '@/lib/domain/shipping/types'

const ERROR_MESSAGES: Record<string, string> = {
  invalid_postal_code: 'Ingresá un código postal argentino de 4 números.',
  postal_code_not_found: 'No encontramos ese código postal.',
  no_shipping_options: 'No hay opciones de envío disponibles para ese código postal.',
  rate_limited: 'Hiciste varias cotizaciones. Esperá unos minutos e intentá de nuevo.',
  shipping_timeout: 'La cotización demoró demasiado. Intentá de nuevo.',
  shipping_provider_error: 'Envia no pudo calcular tarifas en este momento.',
  shipping_unavailable: 'El cotizador no está disponible en este momento.',
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export async function quoteShipping(postalCode: string): Promise<ShippingQuote> {
  const cp = postalCode.trim()
  if (!/^\d{4}$/.test(cp)) {
    throw new AppError('validation', ERROR_MESSAGES.invalid_postal_code, {
      message: 'invalid_postal_code',
    })
  }

  const { data, error } = await getBrowserSupabase().functions.invoke('shipping-quotes', {
    body: { postalCode: cp },
  })
  const payload = record(data)
  if (error || payload.ok !== true) {
    const code = typeof payload.code === 'string' ? payload.code : 'shipping_unavailable'
    throw new AppError(code === 'rate_limited' ? 'validation' : 'unknown', ERROR_MESSAGES[code] || ERROR_MESSAGES.shipping_unavailable, {
      message: code,
      retryable: code !== 'invalid_postal_code' && code !== 'postal_code_not_found',
    })
  }

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
      postalCode: String(destination.postalCode || cp),
      city: String(destination.city || ''),
      state: String(destination.state || ''),
    },
    expiresAt: String(payload.expiresAt || ''),
    options,
  }
}
