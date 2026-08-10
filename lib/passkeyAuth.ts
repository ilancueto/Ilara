// ============================================
// Passkeys / biometría (supakeys)
// Etapa 0: contención — no usar en UI; la Edge Function responde 403.
// ============================================

import { supabase } from '@/lib/supabase'
import { createPasskeyAuth, getUnsupportedReason, getErrorMessage, isPasskeyError } from 'supakeys'
import {
  PASSKEYS_CONTAINED,
  PASSKEY_DISABLED_CODE,
  PASSKEY_DISABLED_MESSAGE,
} from '@/lib/security/passkeysContainment'

function getRpId(): string {
  if (typeof window === 'undefined') return 'localhost'
  const host = window.location.hostname
  return host === '127.0.0.1' ? 'localhost' : host
}

const passkeysImpl = createPasskeyAuth(supabase, {
  rpId: getRpId(),
  rpName: 'Ilara',
  functionName: 'passkey-auth',
})

/** Cliente passkeys: en contención corta en cliente sin llamar al servidor. */
export const passkeys = {
  async signIn() {
    if (PASSKEYS_CONTAINED) {
      return {
        success: false as const,
        session: null,
        error: { code: PASSKEY_DISABLED_CODE, message: PASSKEY_DISABLED_MESSAGE },
      }
    }
    return passkeysImpl.signIn()
  },
  async linkPasskey() {
    if (PASSKEYS_CONTAINED) {
      return {
        success: false as const,
        error: { code: PASSKEY_DISABLED_CODE, message: PASSKEY_DISABLED_MESSAGE },
      }
    }
    return passkeysImpl.linkPasskey()
  },
  async listPasskeys() {
    if (PASSKEYS_CONTAINED) {
      return {
        success: false as const,
        passkeys: [] as const,
        error: { code: PASSKEY_DISABLED_CODE, message: PASSKEY_DISABLED_MESSAGE },
      }
    }
    return passkeysImpl.listPasskeys()
  },
}

export function isPasskeySupported(): boolean {
  if (PASSKEYS_CONTAINED) return false
  return getUnsupportedReason() === null
}

export function getPasskeyUnsupportedReason(): string | null {
  return getUnsupportedReason()
}

export function formatPasskeyError(err: unknown): string {
  if (isPasskeyError(err)) return err.message || getErrorMessage(err.code)
  return err instanceof Error ? err.message : 'Error desconocido'
}
