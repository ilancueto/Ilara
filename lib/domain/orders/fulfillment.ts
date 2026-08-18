export const FULFILLMENT_MODES = ['envio', 'retiro', 'coordinar'] as const

export type FulfillmentMode = (typeof FULFILLMENT_MODES)[number]

export const FULFILLMENT_COPY = {
  envio: {
    title: 'Envío a domicilio',
    hint: 'Cotizamos el correo hasta tu dirección.',
    success: 'Lo enviamos por correo a la dirección que cargaste.',
  },
  retiro: {
    title: 'Retiro en el local',
    hint: 'Pasás a buscarlo. Coordinamos el horario por WhatsApp.',
    success: 'Retiro en el local. Te escribimos para coordinar el horario.',
  },
  coordinar: {
    title: 'A coordinar',
    hint: 'Si estás cerca, lo vemos por WhatsApp. A veces podemos llevarlo por menos.',
    success: 'Entrega a coordinar. Te escribimos para ver la mejor opción.',
  },
} as const

export function isFulfillmentMode(value: unknown): value is FulfillmentMode {
  return value === 'envio' || value === 'retiro' || value === 'coordinar'
}

export function fulfillmentTitle(mode: FulfillmentMode | string | null | undefined): string {
  if (mode === 'retiro') return FULFILLMENT_COPY.retiro.title
  if (mode === 'coordinar') return FULFILLMENT_COPY.coordinar.title
  return FULFILLMENT_COPY.envio.title
}
