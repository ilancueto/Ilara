/**
 * Etapa 0 / SEC-01 — contención de passkeys.
 * Mantener desactivado hasta rediseño (Etapa 1). No reactivar sin fix de identidad.
 */

export const PASSKEYS_CONTAINED = true as const

/** Endpoints de la Edge Function `passkey-auth` bloqueados en contención. */
export const PASSKEY_BLOCKED_ENDPOINTS = [
  '/register/start',
  '/register/finish',
  '/login/start',
  '/login/finish',
  '/passkeys/list',
  '/passkeys/remove',
  '/passkeys/update',
] as const

export type PasskeyBlockedEndpoint = (typeof PASSKEY_BLOCKED_ENDPOINTS)[number]

export const PASSKEY_DISABLED_CODE = 'PASSKEYS_DISABLED' as const

export const PASSKEY_DISABLED_MESSAGE =
  'Passkeys temporalmente desactivadas por seguridad. Usá email y contraseña.' as const

export function isPasskeyEndpointBlocked(endpoint: string): boolean {
  return (PASSKEY_BLOCKED_ENDPOINTS as readonly string[]).includes(endpoint)
}

export function passkeyDisabledApiResponse() {
  return {
    success: false as const,
    error: {
      code: PASSKEY_DISABLED_CODE,
      message: PASSKEY_DISABLED_MESSAGE,
    },
  }
}

/** True cuando la UI no debe ofrecer passkeys. */
export function arePasskeysEnabledInUi(): boolean {
  return !PASSKEYS_CONTAINED
}
