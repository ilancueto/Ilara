import { createBrowserClient } from '@supabase/ssr'
import type { CatalogBadgeKey } from './catalogBadges'

// En el cliente Next inlina process.env.NEXT_PUBLIC_* en build; getEnv() aquí puede fallar si el build fue sin env
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Usar createBrowserClient para que la sesión se guarde en cookies
// y el middleware pueda leerla al proteger rutas
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

// Tipos TypeScript (nombres en español, columnas DB en inglés)
export type Producto = {
  id: number
  name: string
  category_id: number | null
  brand: string | null
  color: string | null
  /** Solo panel autenticado; el catálogo público no lo selecciona (Etapa 0). */
  purchase_price: number | null
  sale_price: number
  stock: number
  min_stock: number
  image_url: string | null
  /** Múltiples imágenes (catálogo). Si existe, preferir sobre image_url. */
  image_urls?: string[] | null
  /** Solo panel; el catálogo público no lo selecciona (Etapa 0). */
  notes: string | null
  created_at: string
  updated_at: string
  /** Porcentaje de descuento en catálogo (0-100). Muestra "En descuento" y precio rebajado. */
  discount_percentage?: number | null
  /** Si false, no se muestra en el catálogo público (útil para ítems sin precio o fotos). */
  visible_in_catalog?: boolean | null
  /** Badge en catálogo: manual o null para automático (novedad por fecha + descuento). */
  catalog_badge?: CatalogBadgeKey | null
  categories?: {
    name: string
  }
  created_by?: string | null
  updated_by?: string | null
}

/** Devuelve la lista de imágenes de un producto (image_urls o [image_url] o []) */
export function getProductImages(p: Producto): string[] {
  if (p.image_urls?.length) return p.image_urls
  if (p.image_url) return [p.image_url]
  return []
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
  /** Email del cliente (opcional). Requiere migración supabase/sql/supabase_customers_email_phone.sql */
  email?: string | null
  /** Teléfono o WhatsApp (opcional). Requiere migración supabase/sql/supabase_customers_email_phone.sql */
  phone?: string | null
  created_at: string
  created_by?: string | null
  updated_by?: string | null
}

/** Un pago en el desglose (múltiples métodos por venta) */
export type PagoDesglose = {
  method: string
  amount: number
}

export type Venta = {
  id: number
  sale_date: string
  total: number
  payment_method: string | null
  /** Desglose cuando hay más de un método de pago. Requiere migración supabase/sql/supabase_sales_payment_breakdown.sql */
  payment_breakdown?: PagoDesglose[] | null
  customer_name: string | null
  customer_id: number | null
  notes: string | null
  receipt_url?: string | null
  status: string
  created_at: string
  customers?: Cliente | null
  /** Usuario que registró la venta. Requiere supabase/sql/supabase_audit_columns.sql */
  created_by?: string | null
  /** Usuario que actualizó por última vez */
  updated_by?: string | null
}

export type ItemVenta = {
  id: number
  sale_id: number
  product_id: number | null
  /** Línea de combo vendido; permite restaurar stock al borrar la venta. */
  combo_id?: number | null
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
  discount_percentage: number
}

/** Combo con sus items (productos y cantidades) */
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

// Tipo para items del carrito (antes de guardar)
export type ItemCarrito = {
  producto?: Producto
  combo?: ComboConItems
  cantidad: number
}

/** Movimiento de stock (historial). Requiere tabla stock_movements. */
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

// ─── Funciones de Autenticación ───

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    if (error.message !== 'Invalid login credentials') {
      console.error('Error al iniciar sesión:', error.message)
    }
    return { user: null, error: error.message }
  }

  return { user: data.user, error: null }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('Error al cerrar sesión:', error.message)
    return { error: error.message }
  }

  return { error: null }
}

export async function getUser() {
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error) {
    console.error('Error al obtener usuario:', error.message)
    return null
  }

  return user
}

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession()

  if (error) {
    console.error('Error al obtener sesión:', error.message)
    return null
  }

  return session
}