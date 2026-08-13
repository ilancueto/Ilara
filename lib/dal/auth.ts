import 'server-only'

/**
 * Autorización cerca de la fuente para Server Actions / RSC autenticados.
 * La fuente de verdad de roles sigue siendo Supabase (RPC/RLS).
 */
import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppError } from '@/lib/domain/errors'
import { parseAppRole, type AppRole } from '@/lib/auth/roleModel'

export type SessionUser = {
  id: string
  email: string | null
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return { id: user.id, email: user.email ?? null }
})

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) {
    throw new AppError('auth', 'Sesión expirada. Volvé a iniciar sesión.', {
      message: 'not_authenticated',
    })
  }
  return user
}

export const getServerAppRole = cache(async (): Promise<AppRole> => {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('current_app_role')
  if (error || data == null) return 'none'
  return parseAppRole(data)
})

/** Sólo admin (modelo de negocio actual: dos cuentas admin; sin vendedores). */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireSessionUser()
  const role = await getServerAppRole()
  if (role !== 'admin') {
    throw new AppError('forbidden', 'No tenés permiso de administrador.', {
      message: 'not_authorized',
    })
  }
  return user
}
