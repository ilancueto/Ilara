import type { SupabaseClient } from '@supabase/supabase-js'
import type { Producto, Categoria, ComboConItems } from '@/lib/supabase'

/** Columnas necesarias para el catálogo público (sin purchase_price ni datos internos). */
export const CATALOG_PRODUCT_SELECT =
  'id, name, brand, color, sale_price, stock, min_stock, category_id, image_url, image_urls, discount_percentage, catalog_badge, visible_in_catalog, created_at, updated_at, notes, categories(name)'

export type CatalogQueryOk<T> = { ok: true; data: T }
export type CatalogQueryErr = { ok: false }
export type CatalogQueryResult<T> = CatalogQueryOk<T> | CatalogQueryErr

export async function fetchCatalogProductsServer(
  supabase: SupabaseClient
): Promise<CatalogQueryResult<Producto[]>> {
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
  return { ok: true, data: (data ?? []) as unknown as Producto[] }
}

export async function fetchCatalogCombosServer(
  supabase: SupabaseClient
): Promise<CatalogQueryResult<ComboConItems[]>> {
  const { data, error } = await supabase
    .from('combos')
    .select(
      `
        *,
        combo_items (id, product_id, quantity, products (*))
      `
    )
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[catalog server] combos', error.message)
    return { ok: false }
  }
  return { ok: true, data: (data ?? []) as unknown as ComboConItems[] }
}

export async function fetchCatalogCategoriesServer(
  supabase: SupabaseClient
): Promise<CatalogQueryResult<Categoria[]>> {
  const { data, error } = await supabase.from('categories').select('*').order('name')

  if (error) {
    console.error('[catalog server] categories', error.message)
    return { ok: false }
  }
  return { ok: true, data: (data ?? []) as unknown as Categoria[] }
}

export type CatalogProductByIdResult =
  | { status: 'ok'; product: Producto }
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
  const p = data as unknown as Producto
  if (p.stock < 0 || p.visible_in_catalog === false) return { status: 'not_found' }
  return { status: 'ok', product: p }
}
