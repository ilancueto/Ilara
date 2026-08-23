import { describe, expect, it } from 'vitest'
import {
  isPublicCatalogComboAvailable,
  isPublicCatalogProductAvailable,
  PUBLIC_CATALOG_MIN_STOCK,
} from '../domain/catalog/publicAvailability'

describe('disponibilidad automática del catálogo público', () => {
  it('oculta productos agotados y los vuelve a admitir al reponer stock', () => {
    expect(PUBLIC_CATALOG_MIN_STOCK).toBe(1)
    expect(isPublicCatalogProductAvailable(0)).toBe(false)
    expect(isPublicCatalogProductAvailable(1)).toBe(true)
  })

  it('oculta combos si alguno de sus componentes no alcanza', () => {
    expect(isPublicCatalogComboAvailable({
      id: 1,
      name: 'Kit',
      description: null,
      sale_price: 1000,
      image_url: null,
      is_active: true,
      created_at: '',
      combo_items: [{
        id: 1,
        product_id: 1,
        quantity: 1,
        products: { id: 1, name: 'Base', brand: null, color: null, sale_price: 1000, stock: 0, category_id: null, image_url: null, created_at: '' },
      }],
    })).toBe(false)
  })
})
