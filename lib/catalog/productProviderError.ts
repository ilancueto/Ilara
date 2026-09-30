/** Fallo transitorio del proveedor. No es ausencia de producto. */
export class ProductProviderUnavailableError extends Error {
  readonly code = 'PRODUCT_PROVIDER_UNAVAILABLE' as const

  constructor() {
    super('PRODUCT_PROVIDER_UNAVAILABLE')
    this.name = 'ProductProviderUnavailableError'
  }
}

export function isProductProviderUnavailableError(err: unknown): boolean {
  if (err instanceof ProductProviderUnavailableError) return true
  return err instanceof Error && (
    err.name === 'ProductProviderUnavailableError'
    || err.message === 'PRODUCT_PROVIDER_UNAVAILABLE'
  )
}
