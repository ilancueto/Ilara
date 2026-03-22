'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'

export type ValidarCuponResult =
    | { ok: true; discount_percentage: number }
    | { ok: false; error: string }

/**
 * Valida un cupón activo **desde el servidor** (misma regla que el cliente, pero centralizada).
 * El catálogo puede seguir usando Supabase directo; esta action sirve para flujos que quieran validar sin exponer lógica extra en el front.
 */
export async function validarCuponCatalogo(code: string): Promise<ValidarCuponResult> {
    const normalized = code.trim().toUpperCase()
    if (!normalized) return { ok: false, error: 'Código vacío' }

    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
        .from('coupons')
        .select('discount_percentage')
        .eq('code', normalized)
        .eq('is_active', true)
        .maybeSingle()

    if (error) return { ok: false, error: error.message }
    if (!data) return { ok: false, error: 'Cupón inválido o inactivo' }
    return { ok: true, discount_percentage: data.discount_percentage }
}
