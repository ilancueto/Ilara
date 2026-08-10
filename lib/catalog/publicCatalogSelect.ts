/**
 * DTO público del catálogo (Etapa 0 / SEC-02).
 * Sin purchase_price, notes, min_stock ni campos de auditoría.
 */

/** Columnas de products permitidas a anon (alineado con grants de migración stage0). */
export const CATALOG_PRODUCT_COLUMNS =
  'id, name, brand, color, sale_price, stock, category_id, image_url, image_urls, discount_percentage, catalog_badge, visible_in_catalog, created_at' as const

export const CATALOG_PRODUCT_SELECT = `${CATALOG_PRODUCT_COLUMNS}, categories(name)` as const

/** Nested product embed for combos (columnas públicas; sin categories anidadas para evitar parse issues). */
export const CATALOG_PRODUCT_EMBED = `products(${CATALOG_PRODUCT_COLUMNS})` as const

export const CATALOG_COMBO_SELECT =
  `id, name, description, sale_price, image_url, is_active, created_at, combo_items(id, product_id, quantity, ${CATALOG_PRODUCT_EMBED})` as const

export const CATALOG_CATEGORY_SELECT = 'id, name' as const

/** Campos que anon no debe poder solicitar sobre products. */
export const CATALOG_PRODUCT_INTERNAL_COLUMNS = [
  'purchase_price',
  'notes',
  'min_stock',
  'created_by',
  'updated_by',
  'updated_at',
] as const
