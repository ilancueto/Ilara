import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente service_role solo para jobs internos de servidor.
 * Nunca importar desde componentes cliente ni NEXT_PUBLIC_*.
 */
export function createSupabaseServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    throw new Error('missing_service_role')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
