import { describe, it, expect } from 'vitest'
import {
  PASSKEYS_CONTAINED,
  PASSKEY_BLOCKED_ENDPOINTS,
  PASSKEY_DISABLED_CODE,
  isPasskeyEndpointBlocked,
  passkeyDisabledApiResponse,
  arePasskeysEnabledInUi,
} from '../security/passkeysContainment'
import { isPasskeySupported, passkeys } from '../passkeyAuth'

describe('passkeysContainment (Etapa 0 / SEC-01)', () => {
  it('mantiene passkeys contenidas', () => {
    expect(PASSKEYS_CONTAINED).toBe(true)
    expect(arePasskeysEnabledInUi()).toBe(false)
    expect(isPasskeySupported()).toBe(false)
  })

  it('bloquea todas las rutas vulnerables de registro e inicio', () => {
    for (const ep of [
      '/register/start',
      '/register/finish',
      '/login/start',
      '/login/finish',
    ]) {
      expect(isPasskeyEndpointBlocked(ep)).toBe(true)
    }
    expect(PASSKEY_BLOCKED_ENDPOINTS.length).toBeGreaterThanOrEqual(4)
  })

  it('respuesta controlada sin secretos ni enumeración de emails', () => {
    const res = passkeyDisabledApiResponse()
    expect(res.success).toBe(false)
    expect(res.error.code).toBe(PASSKEY_DISABLED_CODE)
    expect(res.error.message.toLowerCase()).not.toContain('exists')
    expect(JSON.stringify(res)).not.toMatch(/service_role|eyJ|password/i)
  })

  it('cliente passkeys corta en contención', async () => {
    const signIn = await passkeys.signIn()
    expect(signIn.success).toBe(false)
    expect(signIn.error?.code).toBe(PASSKEY_DISABLED_CODE)

    const link = await passkeys.linkPasskey()
    expect(link.success).toBe(false)

    const list = await passkeys.listPasskeys()
    expect(list.success).toBe(false)
  })
})
