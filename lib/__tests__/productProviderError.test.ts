import { describe, expect, it } from 'vitest'
import { parseLocalSeoFaultText } from '../catalog/parseLocalSeoFault'
import {
  isProductProviderUnavailableError,
  ProductProviderUnavailableError,
} from '../catalog/productProviderError'

describe('error transitorio de ficha', () => {
  it('se distingue de una ausencia', () => {
    const err = new ProductProviderUnavailableError()
    expect(err.code).toBe('PRODUCT_PROVIDER_UNAVAILABLE')
    expect(isProductProviderUnavailableError(err)).toBe(true)
    expect(isProductProviderUnavailableError(new Error('not found'))).toBe(false)
  })
})

describe('archivo local de fallos SEO', () => {
  it('parsea producto y sitemap sin habilitar a un visitante', () => {
    expect(parseLocalSeoFaultText('product 123456789\nsitemap error')).toEqual({
      productIds: new Set(['123456789']),
      sitemap: 'error',
    })
    expect(parseLocalSeoFaultText('{"product":"all","sitemap":"empty"}')).toEqual({
      productIds: 'all',
      sitemap: 'empty',
    })
    expect(parseLocalSeoFaultText('')).toEqual({ productIds: new Set(), sitemap: null })
  })
})
