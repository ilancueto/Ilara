/**
 * Queries de catálogo público agnósticas de entorno (browser o server).
 * Siempre usan CATALOG_*_SELECT (sin columnas internas).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CATALOG_CATEGORY_SELECT,
  CATALOG_COMBO_SELECT,
  CATALOG_PRODUCT_SELECT,
} from '@/lib/catalog/publicCatalogSelect'
import {
  mapPublicCatalogCategories,
  mapPublicCatalogCombos,
  mapPublicCatalogProducts,
  type PublicCatalogCategory,
  type PublicCatalogCombo,
  type PublicCatalogProduct,
} from '@/lib/domain/catalog/publicDto'
import { applyComboPublicPricing, applyProductPublicPricing } from '@/lib/domain/payments/applyPublicPricing'
import { mapPublicPricingContext } from '@/lib/domain/payments/mappers'
import type { PublicPricingContext } from '@/lib/domain/payments/types'
import { PUBLIC_CATALOG_MIN_STOCK } from '@/lib/domain/catalog/publicAvailability'

export type PublicCatalogSnapshot = {
  productos: PublicCatalogProduct[]
  combos: PublicCatalogCombo[]
  categorias: PublicCatalogCategory[]
  pricing: PublicPricingContext
}

export async function fetchPublicCatalogSnapshot(
  client: SupabaseClient
): Promise<{ ok: true; data: PublicCatalogSnapshot } | { ok: false }> {
  const [pr, co, ca, pricing] = await Promise.all([
    client
      .from('products')
      .select(CATALOG_PRODUCT_SELECT)
      .gte('stock', PUBLIC_CATALOG_MIN_STOCK)
      .or('visible_in_catalog.eq.true,visible_in_catalog.is.null')
      .order('created_at', { ascending: false }),
    client.from('combos').select(CATALOG_COMBO_SELECT).eq('is_active', true).order('created_at', {
      ascending: false,
    }),
    client.from('categories').select(CATALOG_CATEGORY_SELECT).order('name'),
    client.rpc('payment_public_pricing_context'),
  ])

  if (pr.error || co.error || ca.error) return { ok: false }

  const context = mapPublicPricingContext(pricing.error ? null : pricing.data)

  return {
    ok: true,
    data: {
      productos: mapPublicCatalogProducts(pr.data).map((item) => applyProductPublicPricing(item, context)),
      combos: mapPublicCatalogCombos(co.data).map((item) => applyComboPublicPricing(item, context)),
      categorias: mapPublicCatalogCategories(ca.data),
      pricing: context,
    },
  }
}
