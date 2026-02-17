// ============================================
// Passkeys / biometría (supakeys)
// ============================================

import { supabase } from '@/lib/supabase'
import { createPasskeyAuth, getUnsupportedReason, getErrorMessage, isPasskeyError } from 'supakeys'

function getRpId(): string {
  if (typeof window === 'undefined') return 'localhost'
  const host = window.location.hostname
  return host === '127.0.0.1' ? 'localhost' : host
}

export const passkeys = createPasskeyAuth(supabase, {
  rpId: getRpId(),
  rpName: 'Ilara',
  functionName: 'passkey-auth',
})

export function isPasskeySupported(): boolean {
  return getUnsupportedReason() === null
}

export function getPasskeyUnsupportedReason(): string | null {
  return getUnsupportedReason()
}

export function formatPasskeyError(err: unknown): string {
  if (isPasskeyError(err)) return err.message || getErrorMessage(err.code)
  return err instanceof Error ? err.message : 'Error desconocido'
}
