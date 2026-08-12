import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getEnv } from '@/lib/env'

/**
 * Cliente Supabase **público** para Server Components del catálogo.
 *
 * - No usa `cookies()` → no fuerza `dynamic` / `no-store` en la ruta.
 * - Sin sesión ni refresh: solo datos públicos vía RLS `anon`.
 * - No usar en panel autenticado, Server Actions de mutación ni auth.
 */
export function createSupabasePublicClient(): SupabaseClient {
  return createClient(
    getEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}
