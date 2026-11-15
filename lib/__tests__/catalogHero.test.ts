import { describe, expect, it } from 'vitest'
import { buildCatalogHero } from '@/lib/domain/catalog/catalogHero'
import type { PublicCatalogProduct } from '@/lib/domain/catalog/publicDto'

const product = (id: number, category_id: number | null, image_url: string | null = `img-${id}`) =>
  ({ id, name: `Producto ${id}`, category_id, image_url, image_urls: null, sale_price: 1000, stock: 3 }) as unknown as PublicCatalogProduct

const categorias = [
  { id: 1, name: 'Labiales' },
  { id: 2, name: 'Skincare' },
  { id: 3, name: 'Otros' },
  { id: 4, name: 'Brochas' },
]

describe('buildCatalogHero', () => {
  it('elige las categorías con más productos y saltea las genéricas', () => {
    const productos = [
      product(1, 3), product(2, 3), product(3, 3), product(4, 3),
      product(5, 1), product(6, 1), product(7, 1),
      product(8, 2), product(9, 2),
      product(10, 4),
    ]
    const hero = buildCatalogHero(productos, categorias)
    expect(hero.tiles.map((t) => [t.name, t.count])).toEqual([['Labiales', 3], ['Skincare', 2]])
  })

  it('no repite fotos entre los accesos y la foto principal', () => {
    const productos = [product(1, 1), product(2, 1), product(3, 2)]
    const hero = buildCatalogHero(productos, categorias)
    const images = [...hero.tiles.map((t) => t.image), hero.photo?.src]
    expect(new Set(images).size).toBe(images.length)
    expect(hero.photo).toEqual({ src: 'img-2', alt: 'Producto 2' })
  })

  it('funciona sin fotos ni categorías', () => {
    expect(buildCatalogHero([product(1, null, null)], [])).toEqual({ photo: null, tiles: [] })
    const hero = buildCatalogHero([product(1, 1, null)], categorias)
    expect(hero.tiles).toEqual([{ id: '1', name: 'Labiales', count: 1, image: null }])
    expect(hero.photo).toBeNull()
  })
})
