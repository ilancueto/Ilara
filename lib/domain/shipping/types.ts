export type ShippingDestination = {
  postalCode: string
  city: string
  state: string
  street: string
  number: string
  formattedAddress: string
}

export type ShippingLocation = {
  id: string
  name: string
  department?: string
}

export type ShippingAddressInput = {
  provinceId: string
  localityId: string
  postalCode: string
  street: string
  number: string
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
