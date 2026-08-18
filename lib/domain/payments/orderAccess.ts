/**
 * Clave de seguimiento del pedido (capability).
 * El cliente nunca ve el secreto de derivación. La DB solo guarda el hash.
 */
const encoder = new TextEncoder()

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function getOrderAccessDerivationSecret(): string {
  const secret = process.env.ORDER_ACCESS_SECRET?.trim()
  if (!secret || secret.length < 16) {
    throw new Error('missing_order_access_secret')
  }
  return secret
}

export async function hashOrderAccessSecret(plain: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(plain))
  return toHex(digest)
}

async function hmacHex(message: string, derivationSecret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(derivationSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return toHex(signed)
}

/** Misma clave para el mismo idempotency_key: un reintento no inventa otra. */
export async function deriveOrderAccessSecret(
  idempotencyKey: string,
  derivationSecret = getOrderAccessDerivationSecret()
): Promise<string> {
  return hmacHex(`ilara-order-access:v1:${idempotencyKey.trim()}`, derivationSecret)
}

/** Token de seguimiento. Distinto de la clave de pago. Determinista por idempotencia. */
export async function deriveOrderFollowSecret(
  idempotencyKey: string,
  derivationSecret = getOrderAccessDerivationSecret()
): Promise<string> {
  return hmacHex(`ilara-order-follow:v1:${idempotencyKey.trim()}`, derivationSecret)
}
