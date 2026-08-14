export type ShippingDestination = {
  postalCode: string
  city: string
  state: string
}

export type ShippingOption = {
  id: string
  carrier: string
  service: string
  deliveryEstimate: string | null
  amount: number
  currency: 'ARS'
}

export type ShippingQuote = {
  destination: ShippingDestination
  expiresAt: string
  options: ShippingOption[]
}
