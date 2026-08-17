/**
 * Contratos del catálogo público (Stage 0 + 5).
 * Por diseño no incluyen purchase_price, notes, min_stock ni auditoría.
 */
import type { CatalogBadgeKey } from '@/lib/catalogBadges'
import { CATALOG_PRODUCT_INTERNAL_COLUMNS } from '@/lib/catalog/publicCatalogSelect'

export type PublicCatalogProduct = {
  id: number
  name: string
  brand: string | null
  color: string | null
  sale_price: number
  stock: number
  category_id: number | null
  image_url: string | null
  image_urls?: string[] | null
  discount_percentage?: number | null
  catalog_badge?: CatalogBadgeKey | null
  visible_in_catalog?: boolean | null
  created_at: string
  categories?: { name: string }
  dual_price_visible?: boolean
  transfer_price?: number
  public_price?: number
}

export type PublicCatalogComboItem = {
  id: number
  product_id: number
  quantity: number
  products?: PublicCatalogProduct
}

export type PublicCatalogCombo = {
  id: number
  name: string
  description: string | null
  sale_price: number
  image_url: string | null
  is_active: boolean
  created_at: string
  combo_items?: PublicCatalogComboItem[]
  dual_price_visible?: boolean
  transfer_price?: number
  public_price?: number
}

export type PublicCatalogCategory = {
  id: number
  name: string
}

/** Claves internas prohibidas en DTO público (defensa en profundidad + tests). */
export const PUBLIC_CATALOG_FORBIDDEN_KEYS = CATALOG_PRODUCT_INTERNAL_COLUMNS

function asNumber(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function asNullableString(v: unknown): string | null {
  if (v == null) return null
  return typeof v === 'string' ? v : null
}

/**
 * Mapea una fila de products (select público) a DTO sin campos internos.
 * Ignora claves prohibidas aunque el backend las devolviera por error.
 */
export function mapPublicCatalogProduct(row: unknown): PublicCatalogProduct {
  const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>
  const cats = r.categories
  let categories: { name: string } | undefined
  if (cats && typeof cats === 'object' && 'name' in cats) {
    categories = { name: asString((cats as { name: unknown }).name, 'Sin categoría') }
  }

  const imageUrls = r.image_urls
  const mapped: PublicCatalogProduct = {
    id: asNumber(r.id),
    name: asString(r.name),
    brand: asNullableString(r.brand),
    color: asNullableString(r.color),
    sale_price: asNumber(r.sale_price),
    stock: asNumber(r.stock),
    category_id: r.category_id == null ? null : asNumber(r.category_id),
    image_url: asNullableString(r.image_url),
    image_urls: Array.isArray(imageUrls)
      ? (imageUrls.filter((x) => typeof x === 'string') as string[])
      : null,
    discount_percentage:
      r.discount_percentage == null ? null : asNumber(r.discount_percentage),
    catalog_badge: (r.catalog_badge as CatalogBadgeKey | null | undefined) ?? null,
    visible_in_catalog:
      r.visible_in_catalog === false
        ? false
        : r.visible_in_catalog === true
          ? true
          : null,
    created_at: asString(r.created_at),
    categories,
  }

  // Defensa: no copiar claves internas al objeto resultante
  for (const key of PUBLIC_CATALOG_FORBIDDEN_KEYS) {
    if (key in mapped) {
      delete (mapped as Record<string, unknown>)[key]
    }
  }

  return mapped
}

export function mapPublicCatalogProducts(rows: unknown[] | null | undefined): PublicCatalogProduct[] {
  return (rows ?? []).map(mapPublicCatalogProduct)
}

export function mapPublicCatalogCombo(row: unknown): PublicCatalogCombo {
  const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>
  const rawItems = Array.isArray(r.combo_items) ? r.combo_items : []
  const combo_items: PublicCatalogComboItem[] = rawItems.map((item) => {
    const it = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    return {
      id: asNumber(it.id),
      product_id: asNumber(it.product_id),
      quantity: asNumber(it.quantity, 1),
      products: it.products ? mapPublicCatalogProduct(it.products) : undefined,
    }
  })

  return {
    id: asNumber(r.id),
    name: asString(r.name),
    description: asNullableString(r.description),
    sale_price: asNumber(r.sale_price),
    image_url: asNullableString(r.image_url),
    is_active: r.is_active !== false,
    created_at: asString(r.created_at),
    combo_items,
  }
}

export function mapPublicCatalogCombos(rows: unknown[] | null | undefined): PublicCatalogCombo[] {
  return (rows ?? []).map(mapPublicCatalogCombo)
}

export function mapPublicCatalogCategories(
  rows: unknown[] | null | undefined
): PublicCatalogCategory[] {
  return (rows ?? []).map((row) => {
    const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>
    return { id: asNumber(r.id), name: asString(r.name) }
  })
}

/** Assert de tiempo de test: el DTO no expone campos internos. */
export function assertNoInternalPublicKeys(obj: object): void {
  const keys = Object.keys(obj)
  for (const forbidden of PUBLIC_CATALOG_FORBIDDEN_KEYS) {
    if (keys.includes(forbidden)) {
      throw new Error(`DTO público expone campo interno: ${forbidden}`)
    }
  }
}
