import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getEnv } from '@/lib/env'

/**
 * Cliente Supabase en **servidor** (Server Components, Server Actions, Route Handlers).
 * Usa cookies de la request; no usar en código que se ejecute en el navegador.
 */
export async function createSupabaseServerClient() {
    const cookieStore = await cookies()
    return createServerClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
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
    })
}
