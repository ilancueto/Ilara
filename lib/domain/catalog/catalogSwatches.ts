import type { PublicCatalogCategory, PublicCatalogProduct } from '@/lib/domain/catalog/publicDto'
import { GENERIC_CATEGORY } from '@/lib/domain/catalog/catalogHero'

/** Una categoría para mostrar como trazo en la portada. */
export type CatalogSwatch = {
  id: string
  name: string
  count: number
}

/**
 * Categorías de la portada: todas las que tienen productos (sin las genéricas tipo "Otros"),
 * las más grandes primero y con un tope para que los trazos no queden demasiado finos.
 */
export function buildCatalogSwatches(
  productos: PublicCatalogProduct[],
  categorias: PublicCatalogCategory[],
  max = 10
): CatalogSwatch[] {
  const counts = new Map<number, number>()
  for (const producto of productos) {
    if (producto.category_id == null) continue
    counts.set(producto.category_id, (counts.get(producto.category_id) ?? 0) + 1)
  }
  return categorias
    .filter((categoria) => !GENERIC_CATEGORY.test(categoria.name.trim()))
    .map((categoria) => ({ id: String(categoria.id), name: categoria.name, count: counts.get(categoria.id) ?? 0 }))
    .filter((swatch) => swatch.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'))
    .slice(0, max)
}

/**
 * Pasteles de los trazos, uno por categoría (se reparten por orden).
 * Todos superan 4.5:1 de contraste con el texto oscuro del catálogo (#3A2030), que va encima.
 */
export const SWATCH_COLORS = [
  '#EE7B90',
  '#B58CC4',
  '#D68DB2',
  '#F4A9BA',
  '#EDB8A0',
  '#8FCDBF',
  '#C7A3DD',
  '#F0829F',
  '#F3C7A2',
  '#9FC5E8',
  '#F2D38C',
  '#B9D9A0',
] as const
