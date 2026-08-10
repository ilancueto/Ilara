import { describe, it, expect } from 'vitest'
import {
  CATALOG_PRODUCT_SELECT,
  CATALOG_COMBO_SELECT,
  CATALOG_CATEGORY_SELECT,
  CATALOG_PRODUCT_INTERNAL_COLUMNS,
} from '../catalog/publicCatalogSelect'

describe('publicCatalogSelect (Etapa 0 / SEC-02)', () => {
  it('no usa select * ni products(*)', () => {
    expect(CATALOG_PRODUCT_SELECT).not.toMatch(/(^|[^*])\*(?!\w)/)
    expect(CATALOG_PRODUCT_SELECT.includes('products (*)')).toBe(false)
    expect(CATALOG_COMBO_SELECT.includes('products (*)')).toBe(false)
    expect(CATALOG_COMBO_SELECT.trim().startsWith('*')).toBe(false)
  })

  it('excluye columnas internas de products', () => {
    for (const col of CATALOG_PRODUCT_INTERNAL_COLUMNS) {
      // purchase_price etc. no deben aparecer como campos de products (sí pueden en comentarios de tests)
      const asField = new RegExp(`(^|[,\\s(])${col}([,\\s)]|$)`)
      expect(CATALOG_PRODUCT_SELECT).not.toMatch(asField)
      expect(CATALOG_COMBO_SELECT).not.toMatch(asField)
    }
  })

  it('incluye superficie pública mínima', () => {
    for (const col of ['id', 'name', 'sale_price', 'image_url', 'discount_percentage', 'catalog_badge', 'stock']) {
      expect(CATALOG_PRODUCT_SELECT).toContain(col)
    }
    expect(CATALOG_CATEGORY_SELECT).toBe('id, name')
    expect(CATALOG_COMBO_SELECT).toContain('combo_items')
  })
})
