import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getEnv } from '@/lib/env'

/**
 * Cliente Supabase en **servidor** con cookies de la request
 * (Server Components dinámicos, Server Actions, Route Handlers).
 *
 * - `server-only`: no entra al bundle cliente.
 * - Anon key + sesión del usuario; **no** service role.
 * - Autorización real sigue en RLS/RPC de Supabase.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    getEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            /* set puede fallar en Server Components puros */
          }
        },
      },
    }
  )
}
