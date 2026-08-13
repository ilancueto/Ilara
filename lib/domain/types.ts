/**
 * Tipos de dominio de panel (admin autenticado).
 * No usar en catálogo público: ver `lib/domain/catalog/publicDto.ts`.
 */
import type { CatalogBadgeKey } from '@/lib/catalogBadges'

export type Producto = {
  id: number
  name: string
  category_id: number | null
  brand: string | null
  color: string | null
  /** Solo panel autenticado; el catálogo público no lo selecciona (Etapa 0/5). */
  purchase_price: number | null
  sale_price: number
  stock: number
  min_stock: number
  image_url: string | null
  image_urls?: string[] | null
  /** Solo panel; el catálogo público no lo selecciona. */
  notes: string | null
  created_at: string
  updated_at: string
  discount_percentage?: number | null
  visible_in_catalog?: boolean | null
  catalog_badge?: CatalogBadgeKey | null
  categories?: {
    name: string
  }
  created_by?: string | null
  updated_by?: string | null
}

export type Cupon = {
  id: number
  code: string
  discount_percentage: number
  is_active: boolean
  created_at: string
}

export type Categoria = {
  id: number
  name: string
}

export type Cliente = {
  id: number
  first_name: string
  last_name: string
  email?: string | null
  phone?: string | null
  created_at: string
  created_by?: string | null
  updated_by?: string | null
}

export type PagoDesglose = {
  method: string
  amount: number
}

export type Venta = {
  id: number
  sale_date: string
  total: number
  payment_method: string | null
  payment_breakdown?: PagoDesglose[] | null
  customer_name: string | null
  customer_id: number | null
  notes: string | null
  receipt_url?: string | null
  status: string
  created_at: string
  customers?: Cliente | null
  created_by?: string | null
  updated_by?: string | null
}

export type ItemVenta = {
  id: number
  sale_id: number
  product_id: number | null
  combo_id?: number | null
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
  discount_percentage: number
}

export type Combo = {
  id: number
  name: string
  description: string | null
  sale_price: number
  image_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type ComboItem = {
  id: number
  combo_id: number
  product_id: number
  quantity: number
  products?: Producto
}

export type ComboConItems = Combo & {
  combo_items?: (ComboItem & { products?: Producto })[]
}

export type ItemCarrito = {
  producto?: Producto
  combo?: ComboConItems
  cantidad: number
}

export type StockMovement = {
  id: number
  product_id: number
  type: 'sale' | 'purchase' | 'adjustment'
  quantity: number
  reference_type: string | null
  reference_id: number | null
  notes: string | null
  created_at: string
  user_id: string | null
}

/** Fuente mínima de imágenes de producto (público o admin). */
export type ProductImageSource = {
  image_url: string | null
  image_urls?: string[] | null
}
