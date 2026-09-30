import { describe, expect, it } from 'vitest'
import { buildCatalogSitemap } from '../catalog/sitemapXml'
import { buildProductJsonLd } from '../productStructuredData'
import type { PublicCatalogProduct } from '../domain/catalog/publicDto'

describe('sitemap del catálogo', () => {
  it('lista catálogo y fichas sin lastmod inventado', () => {
    const result = buildCatalogSitemap('https://ilara.com.ar', [{ id: 86 }, { id: 1 }])
    expect(result.status).toBe(200)
    expect(result.body).toContain('<loc>https://ilara.com.ar/catalogo</loc>')
    expect(result.body).toContain('<loc>https://ilara.com.ar/catalogo/p/86</loc>')
    expect(result.body).not.toContain('<lastmod>')
    expect(result.body).not.toContain('<changefreq>')
    expect(result.body).not.toContain('/pedido')
    expect(result.body).not.toContain('/login')
  })

  it('no sustituye el inventario por una sola URL si falla la consulta', () => {
    const result = buildCatalogSitemap('https://ilara.com.ar', null)
    expect(result.status).toBe(503)
    expect(result.headers['Retry-After']).toBe('300')
    expect(result.headers['Cache-Control']).toBe('no-store')
    expect(result.body).not.toContain('/catalogo/p/')
  })

  it('trata cero productos elegibles como catálogo vacío válido, no como error', () => {
    const result = buildCatalogSitemap('https://ilara.com.ar', [])
    expect(result.status).toBe(200)
    expect(result.body).toContain('<loc>https://ilara.com.ar/catalogo</loc>')
    expect(result.body).not.toContain('/catalogo/p/')
  })
})

describe('JSON-LD de ficha', () => {
  const base: PublicCatalogProduct = {
    id: 1,
    name: 'Bálsamo',
    brand: null,
    color: null,
    sale_price: 2000,
    stock: 5,
    category_id: null,
    image_url: null,
    created_at: '2026-09-05',
  }

  it('omite marca desconocida y no inventa política de devolución', () => {
    const ld = buildProductJsonLd(base, 'https://ilara.com.ar/catalogo/p/1', 'https://ilara.com.ar', 2000)
    expect(ld.brand).toBeUndefined()
    expect(ld.offers).not.toHaveProperty('hasMerchantReturnPolicy')
    expect((ld.offers as { seller: { name: string } }).seller.name).toBe('Ilara Beauty')
  })

  it('usa la marca del producto cuando existe', () => {
    const ld = buildProductJsonLd(
      { ...base, brand: 'Tejar' },
      'https://ilara.com.ar/catalogo/p/1',
      'https://ilara.com.ar',
      2000
    )
    expect(ld.brand).toEqual({ '@type': 'Brand', name: 'Tejar' })
  })
})
