import 'server-only'

/**
 * Lectura de catálogo público en servidor (ISR / RSC).
 * Usa select mínimo Stage 0 y DTO público Stage 5 (sin purchase_price).
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
  mapPublicCatalogProduct,
  mapPublicCatalogProducts,
  type PublicCatalogCategory,
  type PublicCatalogCombo,
  type PublicCatalogProduct,
} from '@/lib/domain/catalog/publicDto'

export { CATALOG_PRODUCT_SELECT } from '@/lib/catalog/publicCatalogSelect'

export type CatalogQueryOk<T> = { ok: true; data: T }
export type CatalogQueryErr = { ok: false }
export type CatalogQueryResult<T> = CatalogQueryOk<T> | CatalogQueryErr

export async function fetchCatalogProductsServer(
  supabase: SupabaseClient
): Promise<CatalogQueryResult<PublicCatalogProduct[]>> {
  const { data, error } = await supabase
    .from('products')
    .select(CATALOG_PRODUCT_SELECT)
    .gte('stock', 0)
    .or('visible_in_catalog.eq.true,visible_in_catalog.is.null')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[catalog server] products', error.message)
    return { ok: false }
  }
  return { ok: true, data: mapPublicCatalogProducts(data ?? []) }
}

export async function fetchCatalogCombosServer(
  supabase: SupabaseClient
): Promise<CatalogQueryResult<PublicCatalogCombo[]>> {
  const { data, error } = await supabase
    .from('combos')
    .select(CATALOG_COMBO_SELECT)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[catalog server] combos', error.message)
    return { ok: false }
  }
  return { ok: true, data: mapPublicCatalogCombos(data ?? []) }
}

export async function fetchCatalogCategoriesServer(
  supabase: SupabaseClient
): Promise<CatalogQueryResult<PublicCatalogCategory[]>> {
  const { data, error } = await supabase
    .from('categories')
    .select(CATALOG_CATEGORY_SELECT)
    .order('name')

  if (error) {
    console.error('[catalog server] categories', error.message)
    return { ok: false }
  }
  return { ok: true, data: mapPublicCatalogCategories(data ?? []) }
}

export type CatalogProductByIdResult =
  | { status: 'ok'; product: PublicCatalogProduct }
  | { status: 'not_found' }
  | { status: 'error' }

export async function fetchCatalogProductByIdServer(
  supabase: SupabaseClient,
  id: number
): Promise<CatalogProductByIdResult> {
  const { data, error } = await supabase
    .from('products')
    .select(CATALOG_PRODUCT_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[catalog server] product by id', error.message)
    return { status: 'error' }
  }
  if (!data) return { status: 'not_found' }
  const p = mapPublicCatalogProduct(data)
  if (p.stock < 0 || p.visible_in_catalog === false) return { status: 'not_found' }
  return { status: 'ok', product: p }
}

/**
 * Productos relacionados para la ficha: prioriza la misma categoría y completa hasta `limit`.
 */
export async function fetchCatalogRelatedProductsServer(
  supabase: SupabaseClient,
  excludeId: number,
  categoryId: number | null,
  limit = 8
): Promise<PublicCatalogProduct[]> {
  const seen = new Set<number>()
  const out: PublicCatalogProduct[] = []

  const pushRows = (rows: unknown) => {
    for (const row of mapPublicCatalogProducts((rows ?? []) as unknown[])) {
      if (row.id === excludeId || seen.has(row.id)) continue
      seen.add(row.id)
      out.push(row)
    }
  }

  try {
    if (categoryId != null) {
      const { data, error } = await supabase
        .from('products')
        .select(CATALOG_PRODUCT_SELECT)
        .neq('id', excludeId)
        .eq('category_id', categoryId)
        .gte('stock', 0)
        .or('visible_in_catalog.eq.true,visible_in_catalog.is.null')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (!error) pushRows(data)
    }

    if (out.length < limit) {
      const { data, error } = await supabase
        .from('products')
        .select(CATALOG_PRODUCT_SELECT)
        .neq('id', excludeId)
        .gte('stock', 0)
        .or('visible_in_catalog.eq.true,visible_in_catalog.is.null')
        .order('created_at', { ascending: false })
        .limit(limit * 2)

      if (!error) pushRows(data)
    }
  } catch {
    return []
  }

  return out.slice(0, limit)
}
