import type { PublicCatalogProduct } from '@/lib/domain/catalog/publicDto'
import { getProductImages } from '@/lib/domain/images'

/** Hasta cuántas unidades se considera "quedan pocas". */
export const LOW_STOCK_MAX = 4

/** Unidades que quedan si son pocas (1 a LOW_STOCK_MAX); si no, null. */
export function lowStockLeft(producto: Pick<PublicCatalogProduct, 'stock'>): number | null {
  return producto.stock > 0 && producto.stock <= LOW_STOCK_MAX ? producto.stock : null
}

export type CatalogRail = {
  /** Cargados más recientemente (con stock y foto). */
  fresh: PublicCatalogProduct[]
  /** Con pocas unidades, las más escasas primero. */
  low: PublicCatalogProduct[]
}

/** Productos para "Para mirar primero": novedades y últimas unidades. */
export function buildCatalogRail(productos: PublicCatalogProduct[], limit = 8): CatalogRail {
  const fresh = productos
    .filter((p) => p.stock > 0 && getProductImages(p).length > 0)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, limit)
  const low = productos
    .filter((p) => lowStockLeft(p) != null)
    .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name, 'es'))
    .slice(0, limit)
  return { fresh, low }
}
