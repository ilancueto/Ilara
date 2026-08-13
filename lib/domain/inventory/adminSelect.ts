/**
 * Selects de inventario/admin (panel autenticado).
 * Incluye purchase_price y campos internos — nunca usar en catálogo público.
 */

const ADMIN_PRODUCT_FIELDS =
  'id, name, category_id, brand, color, purchase_price, sale_price, stock, min_stock, image_url, image_urls, notes, created_at, updated_at, discount_percentage, visible_in_catalog, catalog_badge, created_by, updated_by'

/** Lista POS: stock > 0, con categoría. */
export const ADMIN_POS_PRODUCT_SELECT = `${ADMIN_PRODUCT_FIELDS}, categories(name)` as const

/** Combos activos con productos embebidos (panel). */
export const ADMIN_COMBO_WITH_ITEMS_SELECT =
  `id, name, description, sale_price, image_url, is_active, created_at, updated_at, combo_items(id, combo_id, product_id, quantity, products(${ADMIN_PRODUCT_FIELDS}))` as const

/** Inventario completo con categoría. */
export const ADMIN_INVENTORY_PRODUCT_SELECT = `${ADMIN_PRODUCT_FIELDS}, categories(name)` as const

/** Tablero / stock bajo: columnas admin explícitas (incluye purchase_price). */
export const ADMIN_DASHBOARD_PRODUCT_SELECT =
  'id, name, brand, color, notes, stock, min_stock, sale_price, purchase_price, category_id, created_at, updated_at, image_url, image_urls, categories(name)' as const
