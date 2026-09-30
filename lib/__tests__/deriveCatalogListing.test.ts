import { describe, expect, it } from 'vitest'
import { CATALOG_VIEW_DEFAULT } from '../domain/catalog/catalogView'
import { deriveCatalogListing } from '../domain/catalog/deriveCatalogListing'
import type { PublicCatalogProduct } from '../domain/catalog/publicDto'

function product(id: number, name = `Producto ${id}`): PublicCatalogProduct {
  return {
    id,
    name,
    brand: 'Marca',
    color: null,
    sale_price: 1000 + id,
    stock: 5,
    category_id: 1,
    image_url: null,
    created_at: `2026-01-${String((id % 28) + 1).padStart(2, '0')}`,
    public_price: 1000 + id,
  }
}

describe('listado derivado del catálogo', () => {
  const productos = Array.from({ length: 20 }, (_, i) => product(20 - i))

  it('pagina 1 y 2 entregan ítems distintos', () => {
    const page1 = deriveCatalogListing({
      productos,
      combos: [],
      ventasPorProducto: new Map(),
      view: { ...CATALOG_VIEW_DEFAULT, page: 1 },
    })
    const page2 = deriveCatalogListing({
      productos,
      combos: [],
      ventasPorProducto: new Map(),
      view: { ...CATALOG_VIEW_DEFAULT, page: 2 },
    })
    expect(page1.itemsPagina).toHaveLength(15)
    expect(page2.itemsPagina.length).toBeGreaterThan(0)
    const ids1 = page1.itemsPagina.map((item) => item.id)
    const ids2 = page2.itemsPagina.map((item) => item.id)
    expect(ids1).not.toEqual(ids2)
    expect(ids1.some((id) => ids2.includes(id))).toBe(false)
    expect(page2.outOfRange).toBe(false)
  })

  it('marca fuera de rango sin rellenar con la página 1', () => {
    const listing = deriveCatalogListing({
      productos,
      combos: [],
      ventasPorProducto: new Map(),
      view: { ...CATALOG_VIEW_DEFAULT, page: 9 },
    })
    expect(listing.outOfRange).toBe(true)
    expect(listing.itemsPagina).toEqual([])
  })

  it('búsqueda sin resultados queda vacía en página 1 y fuera de rango en página 2', () => {
    const empty = deriveCatalogListing({
      productos,
      combos: [],
      ventasPorProducto: new Map(),
      view: { ...CATALOG_VIEW_DEFAULT, q: 'inexistenteprueba' },
    })
    expect(empty.totalItems).toBe(0)
    expect(empty.outOfRange).toBe(false)
    const page2 = deriveCatalogListing({
      productos,
      combos: [],
      ventasPorProducto: new Map(),
      view: { ...CATALOG_VIEW_DEFAULT, q: 'inexistenteprueba', page: 2 },
    })
    expect(page2.outOfRange).toBe(true)
  })
})
