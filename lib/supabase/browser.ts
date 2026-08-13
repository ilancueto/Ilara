/**
 * Cliente Supabase **browser** (panel autenticado + refetch catálogo en cliente).
 * Sesión en cookies vía @supabase/ssr para que proxy/middleware la lea.
 *
 * No importa cookies() ni service role. Seguro en bundle cliente.
 */
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

function publicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en el cliente.'
    )
  }
  return { url, anon }
}

/** Singleton del cliente browser (misma instancia entre imports). */
export function getBrowserSupabase(): SupabaseClient {
  if (browserClient) return browserClient
  const { url, anon } = publicEnv()
  browserClient = createBrowserClient(url, anon)
  return browserClient
}

/**
 * Export estable para compatibilidad con el patrón histórico `import { supabase }`.
 * Preferí `getBrowserSupabase()` en código nuevo.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getBrowserSupabase()
    const value = Reflect.get(client, prop, receiver)
    return typeof value === 'function' ? value.bind(client) : value
  },
})

// ─── Auth helpers (browser) ───

export async function signIn(email: string, password: string) {
  const { data, error } = await getBrowserSupabase().auth.signInWithPassword({
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
  const { error } = await getBrowserSupabase().auth.signOut()

  if (error) {
    console.error('Error al cerrar sesión:', error.message)
    return { error: error.message }
  }

  return { error: null }
}

export async function getUser() {
  const {
    data: { user },
    error,
  } = await getBrowserSupabase().auth.getUser()

  if (error) {
    console.error('Error al obtener usuario:', error.message)
    return null
  }

  return user
}

export async function getSession() {
  const {
    data: { session },
    error,
  } = await getBrowserSupabase().auth.getSession()

  if (error) {
    console.error('Error al obtener sesión:', error.message)
    return null
  }

  return session
}
