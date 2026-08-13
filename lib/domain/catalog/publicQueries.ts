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

export type PublicCatalogSnapshot = {
  productos: PublicCatalogProduct[]
  combos: PublicCatalogCombo[]
  categorias: PublicCatalogCategory[]
}

export async function fetchPublicCatalogSnapshot(
  client: SupabaseClient
): Promise<{ ok: true; data: PublicCatalogSnapshot } | { ok: false }> {
  const [pr, co, ca] = await Promise.all([
    client
      .from('products')
      .select(CATALOG_PRODUCT_SELECT)
      .gte('stock', 0)
      .or('visible_in_catalog.eq.true,visible_in_catalog.is.null')
      .order('created_at', { ascending: false }),
    client.from('combos').select(CATALOG_COMBO_SELECT).eq('is_active', true).order('created_at', {
      ascending: false,
    }),
    client.from('categories').select(CATALOG_CATEGORY_SELECT).order('name'),
  ])

  if (pr.error || co.error || ca.error) return { ok: false }

  return {
    ok: true,
    data: {
      productos: mapPublicCatalogProducts(pr.data),
      combos: mapPublicCatalogCombos(co.data),
      categorias: mapPublicCatalogCategories(ca.data),
    },
  }
}
