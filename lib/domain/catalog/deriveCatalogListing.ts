import type { PublicCatalogCombo, PublicCatalogProduct } from '@/lib/domain/catalog/publicDto'
import { catalogDisplayUnitPrice } from '@/lib/domain/payments/catalogDisplayPrice'
import { CATALOG_PAGE_SIZE, COMBOS_FILTER, type CatalogViewState } from '@/lib/domain/catalog/catalogView'
import { isPublicCatalogComboAvailable } from '@/lib/domain/catalog/publicAvailability'
import { catalogItemPrice, normalizeCatalogSearch, sortCatalogItems } from '@/lib/domain/catalog/sorting'

export type CatalogListingInput = {
  productos: PublicCatalogProduct[]
  combos: PublicCatalogCombo[]
  ventasPorProducto: Map<number, number>
  view: CatalogViewState
  pageSize?: number
}

export type CatalogListing = {
  productosFiltrados: PublicCatalogProduct[]
  combosFiltrados: PublicCatalogCombo[]
  combosOrdenados: PublicCatalogCombo[]
  itemsDestacados: Array<PublicCatalogProduct | PublicCatalogCombo>
  totalItems: number
  totalPaginas: number
  itemsPagina: Array<PublicCatalogProduct | PublicCatalogCombo>
  outOfRange: boolean
}

function getPrecioConDescuento(producto: PublicCatalogProduct): number {
  return catalogDisplayUnitPrice(producto)
}

function filterProducts(
  productos: PublicCatalogProduct[],
  view: CatalogViewState,
  ventasPorProducto: Map<number, number>
): PublicCatalogProduct[] {
  return productos
    .filter((p) => {
      if (view.cat === COMBOS_FILTER) return false
      if (view.cat !== 'all' && p.category_id?.toString() !== view.cat) return false
      if (view.q) {
        const termino = normalizeCatalogSearch(view.q)
        if (![p.name, p.brand, p.color, p.categories?.name].some((value) =>
          normalizeCatalogSearch(value ?? '').includes(termino)
        )) {
          return false
        }
      }
      const precioProd = getPrecioConDescuento(p)
      if (precioProd < view.min || precioProd > view.max) return false
      return true
    })
    .sort((a, b) => {
      if (a.stock === 0 && b.stock !== 0) return 1
      if (a.stock !== 0 && b.stock === 0) return -1
      const precioA = getPrecioConDescuento(a)
      const precioB = getPrecioConDescuento(b)
      switch (view.sort) {
        case 'precio-asc':
          return precioA - precioB
        case 'precio-desc':
          return precioB - precioA
        case 'nombre-desc':
          return b.name.localeCompare(a.name)
        case 'nuevo-desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'nuevo-asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'vendidos-desc':
          return (ventasPorProducto.get(b.id) ?? 0) - (ventasPorProducto.get(a.id) ?? 0)
        default:
          return a.name.localeCompare(b.name)
      }
    })
}

function filterCombos(combos: PublicCatalogCombo[], view: CatalogViewState): PublicCatalogCombo[] {
  return combos.filter((c) => {
    if (!isPublicCatalogComboAvailable(c)) return false
    if (view.cat !== 'all' && view.cat !== COMBOS_FILTER) return false
    if (view.q) {
      const t = normalizeCatalogSearch(view.q)
      if (!normalizeCatalogSearch(c.name).includes(t) && !normalizeCatalogSearch(c.description || '').includes(t)) {
        return false
      }
    }
    if (catalogItemPrice(c) < view.min || catalogItemPrice(c) > view.max) return false
    return true
  })
}

function sortCombos(combos: PublicCatalogCombo[], sort: string): PublicCatalogCombo[] {
  return [...combos].sort((a, b) => {
    if (sort === 'precio-asc') return a.sale_price - b.sale_price
    if (sort === 'precio-desc') return b.sale_price - a.sale_price
    if (sort === 'nombre-desc') return b.name.localeCompare(a.name)
    if (sort === 'nuevo-desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    if (sort === 'nuevo-asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    return a.name.localeCompare(b.name)
  })
}

/** Filtrado, orden y paginación del catálogo público. Misma regla en servidor y cliente. */
export function deriveCatalogListing({
  productos,
  combos,
  ventasPorProducto,
  view,
  pageSize = CATALOG_PAGE_SIZE,
}: CatalogListingInput): CatalogListing {
  const productosFiltrados = filterProducts(productos, view, ventasPorProducto)
  const combosFiltrados = filterCombos(combos, view)
  const combosOrdenados = sortCombos(combosFiltrados, view.sort)
  const itemsDestacados = sortCatalogItems(
    [...combosOrdenados, ...productosFiltrados],
    view.sort,
    ventasPorProducto
  )
  const totalItems = itemsDestacados.length
  const totalPaginas = Math.max(1, Math.ceil(totalItems / pageSize))
  const inicio = (view.page - 1) * pageSize
  const itemsPagina = itemsDestacados.slice(inicio, inicio + pageSize)
  return {
    productosFiltrados,
    combosFiltrados,
    combosOrdenados,
    itemsDestacados,
    totalItems,
    totalPaginas,
    itemsPagina,
    outOfRange: view.page > totalPaginas,
  }
}
