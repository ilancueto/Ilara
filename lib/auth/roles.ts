/**
 * Roles de panel (Etapa 1). La autorización real vive en Supabase (RLS/RPC).
 * El frontend solo usa esto para UX (ocultar tabs); no es fuente de seguridad.
 *
 * Bootstrap del primer admin: NO se hace desde el cliente.
 * Ver docs/ETAPA1_RUNBOOK.md (service_role / SQL privilegiado).
 */
import { getBrowserSupabase } from '@/lib/supabase/browser'
import {
  capabilitiesForRole,
  parseAppRole,
  type AppRole,
  type RoleCapabilities,
} from '@/lib/auth/roleModel'

export type { AppRole, RoleCapabilities }
export { capabilitiesForRole, parseAppRole }

export async function fetchCurrentAppRole(): Promise<AppRole> {
  const { data, error } = await getBrowserSupabase().rpc('current_app_role')
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
