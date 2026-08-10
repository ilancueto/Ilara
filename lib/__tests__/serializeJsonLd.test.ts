import { describe, it, expect } from 'vitest'
import { serializeJsonLd } from '../security/serializeJsonLd'
import { buildProductJsonLd } from '../productStructuredData'
import type { Producto } from '../supabase'

describe('serializeJsonLd (Etapa 0 / SEC-04)', () => {
  it('escapa < como \\u003c y resiste </script>', () => {
    const payload = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Labial </script><script>alert(1)</script>',
      description: 'Notas con <img src=x onerror=alert(1)>',
    }
    const html = serializeJsonLd(payload)
    expect(html).not.toContain('</script>')
    expect(html).toContain('\\u003c')
    // Sigue siendo JSON parseable tras des-escapar el unicode de <
    const parsed = JSON.parse(html) as typeof payload
    expect(parsed.name).toContain('</script>')
    expect(parsed['@type']).toBe('Product')
  })

  it('JSON-LD de producto de catálogo no incluye notes internas hostiles como campo notes', () => {
    const p = {
      id: 1,
      name: 'Base </script>',
      brand: 'Marca',
      color: null,
      purchase_price: null,
      sale_price: 1000,
      stock: 5,
      min_stock: 1,
      image_url: null,
      notes: '</script><script>alert(1)</script>',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      category_id: null,
    } as Producto
    const ld = buildProductJsonLd(p, 'https://example.com/p/1', 'https://example.com', 900)
    const html = serializeJsonLd(ld)
    expect(html).not.toMatch(/<\/script>/i)
    expect(ld.description).not.toContain('alert')
    const reparsed = JSON.parse(html)
    expect(reparsed['@type']).toBe('Product')
  })
})
