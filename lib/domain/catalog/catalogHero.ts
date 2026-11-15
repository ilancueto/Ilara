import { getProductImages } from '@/lib/domain/images'
import type { PublicCatalogCategory, PublicCatalogProduct } from '@/lib/domain/catalog/publicDto'

export type CatalogHeroTile = {
  id: string
  name: string
  count: number
  image: string | null
}

export type CatalogHero = {
  photo: { src: string; alt: string } | null
  tiles: CatalogHeroTile[]
}

/** Categorías genéricas que no sirven como acceso destacado. */
const GENERIC_CATEGORY = /^(otros?|varios|sin categor[ií]a)$/i

/**
 * Elige qué mostrar en la portada: las categorías con más productos (sin las genéricas)
 * y una foto grande distinta de las de los accesos.
 */
export function buildCatalogHero(
  productos: PublicCatalogProduct[],
  categorias: PublicCatalogCategory[],
  maxTiles = 2
): CatalogHero {
  const byCategory = new Map<number, PublicCatalogProduct[]>()
  for (const producto of productos) {
    if (producto.category_id == null) continue
    const list = byCategory.get(producto.category_id) ?? []
    list.push(producto)
    byCategory.set(producto.category_id, list)
  }

  const firstImage = (list: PublicCatalogProduct[], skip: Set<string>) => {
    for (const producto of list) {
      const src = getProductImages(producto)[0]
      if (src && !skip.has(src)) return { src, producto }
    }
    return null
  }

  const used = new Set<string>()
  const tiles: CatalogHeroTile[] = categorias
    .filter((categoria) => !GENERIC_CATEGORY.test(categoria.name.trim()))
    .map((categoria) => ({ categoria, list: byCategory.get(categoria.id) ?? [] }))
    .filter(({ list }) => list.length > 0)
    .sort((a, b) => b.list.length - a.list.length || a.categoria.name.localeCompare(b.categoria.name, 'es'))
    .slice(0, maxTiles)
    .map(({ categoria, list }) => {
      const hit = firstImage(list, used)
      if (hit) used.add(hit.src)
      return { id: String(categoria.id), name: categoria.name, count: list.length, image: hit?.src ?? null }
    })

  const featuredCategory = tiles[0] ? byCategory.get(Number(tiles[0].id)) ?? [] : []
  const hit = firstImage(featuredCategory, used) ?? firstImage(productos, used)
  return {
    photo: hit ? { src: hit.src, alt: hit.producto.name } : null,
    tiles,
  }
}
