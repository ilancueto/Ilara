import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
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

  it('no conserva el cliente histórico de passkeys', () => {
    expect(existsSync(join(process.cwd(), 'lib', 'passkeyAuth.ts'))).toBe(false)
  })
})
