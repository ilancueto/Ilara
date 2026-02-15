import { createBrowserClient } from '@supabase/ssr'

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
  purchase_price: number | null
  sale_price: number
  stock: number
  min_stock: number
  image_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
  /** Porcentaje de descuento en catálogo (0-100). Muestra "En descuento" y precio rebajado. */
  discount_percentage?: number | null
  categories?: {
    name: string
  }
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
  created_at: string
}

export type Venta = {
  id: number
  sale_date: string
  total: number
  payment_method: string | null
  customer_name: string | null
  customer_id: number | null
  notes: string | null
  receipt_url?: string | null
  status: string
  created_at: string
  customers?: Cliente | null
}

export type ItemVenta = {
  id: number
  sale_id: number
  product_id: number | null
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
  discount_percentage: number
}

// Tipo para items del carrito (antes de guardar)
export type ItemCarrito = {
  producto: Producto
  cantidad: number
}

// ─── Funciones de Autenticación ───

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error('Error al iniciar sesión:', error.message)
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