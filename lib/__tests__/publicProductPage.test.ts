import { describe, expect, it } from 'vitest'
import { parsePublicProductId } from '../catalog/parsePublicProductId'
import { applyProductPublicPricing } from '../domain/payments/applyPublicPricing'
import { catalogDisplayUnitPrice } from '../domain/payments/catalogDisplayPrice'
import { buildProductJsonLd } from '../productStructuredData'
import { serializeJsonLd } from '../security/serializeJsonLd'
import type { PublicCatalogProduct } from '../domain/catalog/publicDto'
import type { PublicPricingContext } from '../domain/payments/types'

const pricing: PublicPricingContext = {
  catalog_dual_price_visible: true,
  version_id: 'v1',
  transfer_discount_rate: 0.1,
  effective_fee_rate: null,
  rounding_increment: 1,
}

function product(partial: Partial<PublicCatalogProduct> = {}): PublicCatalogProduct {
  return {
    id: 1,
    name: 'Bálsamo',
    brand: null,
    color: null,
    sale_price: 10000,
    stock: 5,
    category_id: null,
    image_url: null,
    created_at: '2026-01-01',
    ...partial,
  }
}

describe('parsePublicProductId', () => {
  it('acepta enteros positivos y rechaza sufijos o basura', () => {
    expect(parsePublicProductId('86')).toBe(86)
    expect(parsePublicProductId('999999991')).toBe(999999991)
    expect(parsePublicProductId('86abc')).toBeNull()
    expect(parsePublicProductId('08')).toBe(8)
    expect(parsePublicProductId('0')).toBeNull()
    expect(parsePublicProductId('-1')).toBeNull()
    expect(parsePublicProductId('1.5')).toBeNull()
    expect(parsePublicProductId('')).toBeNull()
  })
})

describe('JSON-LD de oferta pública', () => {
  it('publica el precio de lista con descuento, no el de transferencia', () => {
    const priced = applyProductPublicPricing(product({ discount_percentage: 10 }), pricing)
    const unit = catalogDisplayUnitPrice(priced)
    expect(unit).toBe(9000)
    expect(priced.transfer_price).toBe(8100)
    const ld = buildProductJsonLd(priced, 'https://ilara.com.ar/catalogo/p/1', 'https://ilara.com.ar', unit)
    expect((ld.offers as { price: number }).price).toBe(9000)
    expect(JSON.stringify(ld)).not.toContain('8100')
    expect(ld).not.toHaveProperty('brand')
    expect(ld.image).toBeUndefined()
  })

  it('incluye marca e imagen sólo cuando existen', () => {
    const priced = applyProductPublicPricing(
      product({ brand: 'Tejar', image_url: 'https://cdn.example/p.jpg' }),
      pricing
    )
    const ld = buildProductJsonLd(priced, 'https://ilara.com.ar/catalogo/p/1', 'https://ilara.com.ar', catalogDisplayUnitPrice(priced))
    expect(ld.brand).toEqual({ '@type': 'Brand', name: 'Tejar' })
    expect(ld.image).toEqual(['https://cdn.example/p.jpg'])
  })

  it('escapa contenido peligroso en JSON-LD', () => {
    const html = serializeJsonLd(buildProductJsonLd(
      product({ name: 'Labial </script><script>alert(1)</script>' }),
      'https://ilara.com.ar/catalogo/p/1',
      'https://ilara.com.ar',
      10000
    ))
    expect(html).not.toContain('</script>')
  })
})
