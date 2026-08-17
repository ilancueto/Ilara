import { priceWithProductDiscount } from '@/lib/catalogPricing'
import { publicPriceFromBase } from '@/lib/domain/payments/pricing'
import type { PublicPricingContext } from '@/lib/domain/payments/types'
import type { PublicCatalogCombo, PublicCatalogProduct } from '@/lib/domain/catalog/publicDto'

export function applyProductPublicPricing(
  product: PublicCatalogProduct,
  context: PublicPricingContext
): PublicCatalogProduct {
  if (!context.catalog_dual_price_visible || context.effective_fee_rate == null || context.rounding_increment == null) {
    return { ...product, dual_price_visible: false }
  }
  const transfer = priceWithProductDiscount(product.sale_price, product.discount_percentage)
  return {
    ...product,
    dual_price_visible: true,
    transfer_price: transfer,
    public_price: publicPriceFromBase(transfer, context.effective_fee_rate, context.rounding_increment),
  }
}

export function applyComboPublicPricing(
  combo: PublicCatalogCombo,
  context: PublicPricingContext
): PublicCatalogCombo {
  if (!context.catalog_dual_price_visible || context.effective_fee_rate == null || context.rounding_increment == null) {
    return { ...combo, dual_price_visible: false }
  }
  const transfer = Math.round(combo.sale_price)
  return {
    ...combo,
    dual_price_visible: true,
    transfer_price: transfer,
    public_price: publicPriceFromBase(transfer, context.effective_fee_rate, context.rounding_increment),
  }
}
