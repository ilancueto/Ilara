import { describe, expect, it } from 'vitest'
import { SWATCH_COLORS, buildCatalogSwatches } from '@/lib/domain/catalog/catalogSwatches'
import { LOW_STOCK_MAX, buildCatalogRail, lowStockLeft } from '@/lib/domain/catalog/catalogRail'
import { BUDGET_NO_LIMIT, BUDGET_PRESETS, activeBudgetPreset } from '@/lib/domain/catalog/catalogBudget'
import type { PublicCatalogProduct } from '@/lib/domain/catalog/publicDto'

const product = (id: number, category_id: number | null, stock = 5, created_at = '2026-01-01T00:00:00Z', image: string | null = `img-${id}`) =>
  ({ id, name: `Producto ${id}`, category_id, image_url: image, image_urls: null, sale_price: 1000, stock, created_at }) as unknown as PublicCatalogProduct

const categorias = [
  { id: 1, name: 'Labiales' },
  { id: 2, name: 'Skincare' },
  { id: 3, name: 'Otros' },
  { id: 4, name: 'Brochas' },
  { id: 5, name: 'Vacía' },
]

describe('buildCatalogSwatches', () => {
  it('lista las categorías con productos, de mayor a menor, sin las genéricas ni las vacías', () => {
    const productos = [product(1, 3), product(2, 1), product(3, 1), product(4, 2), product(5, 4), product(6, 4)]
    expect(buildCatalogSwatches(productos, categorias).map((s) => [s.name, s.count])).toEqual([
      ['Brochas', 2],
      ['Labiales', 2],
      ['Skincare', 1],
    ])
  })

  it('una categoría nueva aparece sola y respeta el tope', () => {
    const productos = [product(1, 1), product(2, 9)]
    const todas = [...categorias, { id: 9, name: 'Fragancias' }]
    expect(buildCatalogSwatches(productos, todas).map((s) => s.name)).toEqual(['Fragancias', 'Labiales'])
    expect(buildCatalogSwatches(productos, todas, 1)).toHaveLength(1)
  })

  it('sin productos no hay trazos', () => {
    expect(buildCatalogSwatches([], categorias)).toEqual([])
  })
})

describe('SWATCH_COLORS', () => {
  const luminance = (hex: string) => {
    const channel = (start: number) => {
      const v = parseInt(hex.slice(start, start + 2), 16) / 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
  }

  it('cada trazo tiene contraste AA con el texto oscuro que lleva encima', () => {
    const ink = luminance('#3A2030')
    for (const color of SWATCH_COLORS) {
      expect((luminance(color) + 0.05) / (ink + 0.05)).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('lowStockLeft', () => {
  it('avisa solo cuando quedan pocas unidades', () => {
    expect(lowStockLeft({ stock: 0 })).toBeNull()
    expect(lowStockLeft({ stock: 1 })).toBe(1)
    expect(lowStockLeft({ stock: LOW_STOCK_MAX })).toBe(LOW_STOCK_MAX)
    expect(lowStockLeft({ stock: LOW_STOCK_MAX + 1 })).toBeNull()
  })
})

describe('buildCatalogRail', () => {
  it('novedades: los más nuevos con stock y foto; últimas unidades: los más escasos primero', () => {
    const productos = [
      product(1, 1, 10, '2026-01-01T00:00:00Z'),
      product(2, 1, 3, '2026-03-01T00:00:00Z'),
      product(3, 1, 0, '2026-04-01T00:00:00Z'),
      product(4, 1, 10, '2026-05-01T00:00:00Z', null),
      product(5, 1, 1, '2026-02-01T00:00:00Z'),
    ]
    const rail = buildCatalogRail(productos)
    expect(rail.fresh.map((p) => p.id)).toEqual([2, 5, 1])
    expect(rail.low.map((p) => p.id)).toEqual([5, 2])
  })
})

describe('presupuesto', () => {
  it('cada atajo coincide con su rango y ninguno con uno ajeno', () => {
    expect(activeBudgetPreset(0, 2000)?.id).toBe('hasta-2000')
    expect(activeBudgetPreset(5001, BUDGET_NO_LIMIT)?.id).toBe('mas-5000')
    expect(activeBudgetPreset(0, BUDGET_NO_LIMIT)).toBeNull()
    expect(activeBudgetPreset(100, 2000)).toBeNull()
    expect(new Set(BUDGET_PRESETS.map((p) => p.id)).size).toBe(BUDGET_PRESETS.length)
  })
})
