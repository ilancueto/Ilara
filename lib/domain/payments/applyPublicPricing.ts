import { priceWithProductDiscount } from '@/lib/catalogPricing'
import { transferPriceFromList } from '@/lib/domain/payments/pricing'
import type { PublicPricingContext } from '@/lib/domain/payments/types'
import type { PublicCatalogCombo, PublicCatalogProduct } from '@/lib/domain/catalog/publicDto'

export function applyProductPublicPricing(
  product: PublicCatalogProduct,
  context: PublicPricingContext
): PublicCatalogProduct {
  if (context.transfer_discount_rate == null) {
    return { ...product, dual_price_visible: false }
  }
  const list = priceWithProductDiscount(product.sale_price, product.discount_percentage)
  return {
    ...product,
    dual_price_visible: context.catalog_dual_price_visible === true,
    transfer_price: transferPriceFromList(list, context.transfer_discount_rate),
    public_price: list,
  }
}

export function applyComboPublicPricing(
  combo: PublicCatalogCombo,
  context: PublicPricingContext
): PublicCatalogCombo {
  if (context.transfer_discount_rate == null) {
    return { ...combo, dual_price_visible: false }
  }
  const list = Math.round(combo.sale_price)
  return {
    ...combo,
    dual_price_visible: context.catalog_dual_price_visible === true,
    transfer_price: transferPriceFromList(list, context.transfer_discount_rate),
    public_price: list,
  }
}
