'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Si quedan cookies de sesión inválidas (p. ej. refresh revocado en Supabase),
 * getSession intenta refrescar y falla con refresh_token_not_found → ruido en consola.
 * Cerramos sesión en el cliente para limpiar cookies y estado.
 */
export function SupabaseSessionRecovery() {
    useEffect(() => {
        void supabase.auth.getSession().then(({ error }) => {
            if (!error) return
            const code = error.code ?? ''
            const msg = error.message ?? ''
            if (code === 'refresh_token_not_found' || msg.includes('Refresh Token')) {
                void supabase.auth.signOut()
            }
        })
    }, [])

    return null
}
