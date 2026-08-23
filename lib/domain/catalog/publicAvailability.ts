import { CATALOG_CONFIG } from '@/lib/config'
import type { PublicCatalogCombo, PublicCatalogProduct } from '@/lib/domain/catalog/publicDto'

/**
 * El catálogo público no ofrece productos agotados por defecto. El mínimo se
 * centraliza para que la grilla, las fichas y los productos relacionados
 * compartan exactamente la misma regla.
 */
export const PUBLIC_CATALOG_MIN_STOCK = CATALOG_CONFIG.showOutOfStock ? 0 : 1

export function isPublicCatalogProductAvailable(stock: number): boolean {
  return Number.isFinite(stock) && stock >= PUBLIC_CATALOG_MIN_STOCK
}

/** Un combo sólo se muestra si todos sus componentes alcanzan la cantidad requerida. */
export function isPublicCatalogComboAvailable(combo: PublicCatalogCombo): boolean {
  const items = combo.combo_items || []
  return items.length > 0 && items.every((item) => {
    const product = item.products
    return Boolean(
      product &&
      product.visible_in_catalog !== false &&
      isPublicCatalogProductAvailable(product.stock) &&
      product.stock >= item.quantity
    )
  })
}

export function isPublicCatalogProductVisible(product: Pick<PublicCatalogProduct, 'stock' | 'visible_in_catalog'>): boolean {
  return product.visible_in_catalog !== false && isPublicCatalogProductAvailable(product.stock)
}
