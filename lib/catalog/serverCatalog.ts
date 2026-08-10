import type { SupabaseClient } from '@supabase/supabase-js'
import type { Producto, Categoria, ComboConItems } from '@/lib/supabase'
import {
  CATALOG_CATEGORY_SELECT,
  CATALOG_COMBO_SELECT,
  CATALOG_PRODUCT_SELECT,
} from '@/lib/catalog/publicCatalogSelect'

export { CATALOG_PRODUCT_SELECT } from '@/lib/catalog/publicCatalogSelect'

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
  return { ok: true, data: normalizeCatalogProducts(data ?? []) }
}

export async function fetchCatalogCombosServer(
  supabase: SupabaseClient
): Promise<CatalogQueryResult<ComboConItems[]>> {
  const { data, error } = await supabase
    .from('combos')
    .select(CATALOG_COMBO_SELECT)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[catalog server] combos', error.message)
    return { ok: false }
  }
  return { ok: true, data: normalizeCatalogCombos(data ?? []) }
}

export async function fetchCatalogCategoriesServer(
  supabase: SupabaseClient
): Promise<CatalogQueryResult<Categoria[]>> {
  const { data, error } = await supabase
    .from('categories')
    .select(CATALOG_CATEGORY_SELECT)
    .order('name')

  if (error) {
    console.error('[catalog server] categories', error.message)
    return { ok: false }
  }
  return { ok: true, data: (data ?? []) as Categoria[] }
}

/** Completa campos internos no expuestos al público con valores seguros por defecto. */
function normalizeCatalogProduct(row: Record<string, unknown>): Producto {
  return {
    ...(row as object),
    purchase_price: null,
    min_stock: 0,
    notes: null,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : (row.created_at as string) || '',
  } as Producto
}

function normalizeCatalogProducts(rows: unknown[]): Producto[] {
  return rows.map((r) => normalizeCatalogProduct(r as Record<string, unknown>))
}

function normalizeCatalogCombos(rows: unknown[]): ComboConItems[] {
  return rows.map((raw) => {
    const r = raw as ComboConItems & { combo_items?: Array<{ products?: unknown }> }
    const items = (r.combo_items ?? []).map((item) => ({
      ...item,
      products: item.products
        ? normalizeCatalogProduct(item.products as Record<string, unknown>)
        : undefined,
    }))
    return { ...r, combo_items: items, updated_at: r.updated_at ?? r.created_at }
  })
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
  const p = normalizeCatalogProduct(data as Record<string, unknown>)
  if (p.stock < 0 || p.visible_in_catalog === false) return { status: 'not_found' }
  return { status: 'ok', product: p }
}

/**
 * Productos relacionados para la ficha: prioriza la misma categoría y completa hasta `limit` con el resto del catálogo.
 */
export async function fetchCatalogRelatedProductsServer(
  supabase: SupabaseClient,
  excludeId: number,
  categoryId: number | null,
  limit = 8
): Promise<Producto[]> {
  const seen = new Set<number>()
  const out: Producto[] = []

  const pushRows = (rows: unknown) => {
    for (const row of normalizeCatalogProducts((rows ?? []) as unknown[])) {
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
