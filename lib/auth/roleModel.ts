/**
 * Modelo de roles (puro, sin I/O).
 * La autorización real vive en Supabase (RLS/RPC).
 *
 * Negocio actual: sólo administradores operan el panel.
 * El rol `vendedor` existe en el esquema histórico pero no se usa en producto.
 */

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
