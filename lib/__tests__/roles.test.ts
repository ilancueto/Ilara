import { describe, it, expect } from 'vitest'
import { capabilitiesForRole, parseAppRole } from '../auth/roles'

describe('capabilitiesForRole (Etapa 1 UX)', () => {
  it('admin: POS, inventario, finanzas, admin', () => {
    const c = capabilitiesForRole('admin')
    expect(c.canUsePos).toBe(true)
    expect(c.canManageInventory).toBe(true)
    expect(c.isAdmin).toBe(true)
    expect(c.canManageFinance).toBe(true)
  })

  it('vendedor: POS y gastos; sin inventario ni admin', () => {
    const c = capabilitiesForRole('vendedor')
    expect(c.canUsePos).toBe(true)
    expect(c.canManageInventory).toBe(false)
    expect(c.isAdmin).toBe(false)
    expect(c.canManageFinance).toBe(true)
  })

  it('none: sin privilegios de panel', () => {
    const c = capabilitiesForRole('none')
    expect(c.canUsePos).toBe(false)
    expect(c.canManageInventory).toBe(false)
    expect(c.isAdmin).toBe(false)
    expect(c.canManageFinance).toBe(false)
  })
})

describe('parseAppRole', () => {
  it('acepta roles válidos y cae a none', () => {
    expect(parseAppRole('admin')).toBe('admin')
    expect(parseAppRole('vendedor')).toBe('vendedor')
    expect(parseAppRole('none')).toBe('none')
    expect(parseAppRole('superuser')).toBe('none')
    expect(parseAppRole(null)).toBe('none')
  })
})

describe('roles.ts no autoclaim bootstrap', () => {
  it('módulo no exporta tryBootstrapFirstAdmin ni llama bootstrap en load', async () => {
    const mod = await import('../auth/roles')
    expect(mod).not.toHaveProperty('tryBootstrapFirstAdmin')
    expect(typeof mod.loadRoleCapabilities).toBe('function')
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(process.cwd(), 'lib', 'auth', 'roles.ts'), 'utf8')
    expect(src).not.toMatch(/bootstrap_first_admin/)
    expect(src).not.toMatch(/tryBootstrap/)
  })
})
