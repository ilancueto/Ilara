import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  PASSKEYS_CONTAINED,
  PASSKEY_BLOCKED_ENDPOINTS,
  arePasskeysEnabledInUi,
  isPasskeyEndpointBlocked,
  passkeyDisabledApiResponse,
  PASSKEY_DISABLED_CODE,
  PASSKEY_DISABLED_MESSAGE,
} from '@/lib/security/passkeysContainment'

/**
 * `lib/security/passkeysContainment.ts` forma parte del alcance de contención
 * Etapa 0 mantenido en Etapa 1 (passkeys off hasta v2 auditada).
 */
describe('passkeys contención (Etapa 1)', () => {
  it('permanecen deshabilitadas', () => {
    expect(PASSKEYS_CONTAINED).toBe(true)
    expect(arePasskeysEnabledInUi()).toBe(false)
  })

  it('bloquea todos los endpoints WebAuthn listados', () => {
    expect(PASSKEY_BLOCKED_ENDPOINTS).toEqual(
      expect.arrayContaining([
        '/register/start',
        '/register/finish',
        '/login/start',
        '/login/finish',
        '/passkeys/list',
        '/passkeys/remove',
        '/passkeys/update',
      ])
    )
    for (const ep of PASSKEY_BLOCKED_ENDPOINTS) {
      expect(isPasskeyEndpointBlocked(ep)).toBe(true)
    }
  })

  it('respuesta API de contención sin secretos ni enumeración', () => {
    const r = passkeyDisabledApiResponse()
    expect(r.success).toBe(false)
    expect(r.error.code).toBe(PASSKEY_DISABLED_CODE)
    expect(r.error.message).toBe(PASSKEY_DISABLED_MESSAGE)
    const blob = JSON.stringify(r)
    expect(blob).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/)
    expect(blob).not.toMatch(/service_role|SUPABASE_SERVICE|private.?key/i)
    expect(blob).not.toMatch(/user_not_found|email_exists|no such user/i)
  })

  it('cliente passkeyAuth corta signIn/link/list en contención', () => {
    const src = readFileSync(join(process.cwd(), 'lib', 'passkeyAuth.ts'), 'utf8')
    expect(src).toMatch(/PASSKEYS_CONTAINED/)
    expect(src).toMatch(/async signIn\(/)
    expect(src).toMatch(/async linkPasskey\(/)
    expect(src).toMatch(/async listPasskeys\(/)
    expect(src).toMatch(/PASSKEY_DISABLED_CODE/)
    // Cada método cliente guarda con contención antes de llamar a supakeys
    const methods = ['signIn', 'linkPasskey', 'listPasskeys'] as const
    for (const m of methods) {
      const re = new RegExp(`async ${m}\\([\\s\\S]*?PASSKEYS_CONTAINED[\\s\\S]*?PASSKEY_DISABLED_CODE`)
      expect(src, `método ${m} debe cortar con contención`).toMatch(re)
    }
    expect(src).toMatch(/if \(PASSKEYS_CONTAINED\) return false/)
  })
})
