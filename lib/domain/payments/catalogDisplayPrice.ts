import { priceWithProductDiscount } from '@/lib/catalogPricing'
import type { PublicCatalogCombo, PublicCatalogProduct } from '@/lib/domain/catalog/publicDto'

/** Precio que ve la clienta. Si Mercado Pago está activo, es el precio público. */
export function catalogDisplayUnitPrice(
  item: Pick<PublicCatalogProduct, 'sale_price' | 'discount_percentage' | 'public_price'>
): number {
  if (item.public_price != null && Number.isFinite(item.public_price)) return item.public_price
  return priceWithProductDiscount(item.sale_price, item.discount_percentage)
}

export function catalogDisplayComboPrice(
  combo: Pick<PublicCatalogCombo, 'sale_price' | 'public_price'>
): number {
  if (combo.public_price != null && Number.isFinite(combo.public_price)) return combo.public_price
  return Math.round(combo.sale_price)
}
