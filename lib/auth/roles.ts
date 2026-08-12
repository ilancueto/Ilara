/**
 * Roles de panel (Etapa 1). La autorización real vive en Supabase (RLS/RPC).
 * El frontend solo usa esto para UX (ocultar tabs); no es fuente de seguridad.
 *
 * Bootstrap del primer admin: NO se hace desde el cliente.
 * Ver docs/ETAPA1_RUNBOOK.md (service_role / SQL privilegiado).
 */
import { supabase } from '@/lib/supabase'

export type AppRole = 'admin' | 'vendedor' | 'none'

export type RoleCapabilities = {
  role: AppRole
  canUsePos: boolean
  canManageInventory: boolean
  canManageFinance: boolean
  isAdmin: boolean
}

export function capabilitiesForRole(role: AppRole): RoleCapabilities {
  return {
    role,
    canUsePos: role === 'admin' || role === 'vendedor',
    canManageInventory: role === 'admin',
    canManageFinance: role === 'admin' || role === 'vendedor',
    isAdmin: role === 'admin',
  }
}

export function parseAppRole(value: unknown): AppRole {
  const r = String(value ?? '')
  if (r === 'admin' || r === 'vendedor' || r === 'none') return r
  return 'none'
}

export async function fetchCurrentAppRole(): Promise<AppRole> {
  const { data, error } = await supabase.rpc('current_app_role')
  if (error || data == null) return 'none'
  return parseAppRole(data)
}

/**
 * Carga capacidades del usuario autenticado.
 * No reclama admin automáticamente (sin autoclaim / bootstrap desde UI).
 */
export async function loadRoleCapabilities(): Promise<RoleCapabilities> {
  const role = await fetchCurrentAppRole()
  return capabilitiesForRole(role)
}
