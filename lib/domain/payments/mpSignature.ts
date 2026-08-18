/**
 * Validación oficial de webhooks Mercado Pago (x-signature).
 * Manifest: id:{data.id};request-id:{x-request-id};ts:{ts};
 */
const encoder = new TextEncoder()

export function parseMpSignatureHeader(header: string | null | undefined): { ts: string; v1: string } | null {
  if (!header) return null
  const parts = Object.fromEntries(
    header
      .split(',')
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const idx = chunk.indexOf('=')
        return idx === -1 ? [chunk, ''] : [chunk.slice(0, idx), chunk.slice(idx + 1)]
      })
  )
  const ts = String(parts.ts || '').trim()
  const v1 = String(parts.v1 || '').trim()
  if (!ts || !/^\d+$/.test(ts) || !/^[0-9a-f]{64}$/i.test(v1)) return null
  return { ts, v1 }
}

export function mpWebhookManifest(input: { dataId: string; requestId: string; ts: string }): string {
  return `id:${input.dataId};request-id:${input.requestId};ts:${input.ts};`
}

export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return Array.from(new Uint8Array(signed), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function timingSafeEqualHex(left: string, right: string): boolean {
  const a = left.toLowerCase()
  const b = right.toLowerCase()
  if (a.length !== b.length || a.length === 0) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verifyMpWebhookSignature(input: {
  signatureHeader: string | null | undefined
  requestId: string | null | undefined
  dataId: string | null | undefined
  secret: string
  nowMs?: number
  maxSkewSeconds?: number
}): Promise<boolean> {
  const parsed = parseMpSignatureHeader(input.signatureHeader)
  const dataId = String(input.dataId || '').trim()
  const requestId = String(input.requestId || '').trim()
  const secret = input.secret.trim()
  if (!parsed || !dataId || !requestId || secret.length < 16) return false

  const nowMs = input.nowMs ?? Date.now()
  const maxSkew = (input.maxSkewSeconds ?? 300) * 1000
  const tsMs = Number(parsed.ts) * 1000
  if (!Number.isFinite(tsMs) || Math.abs(nowMs - tsMs) > maxSkew) return false

  const expected = await hmacSha256Hex(
    secret,
    mpWebhookManifest({ dataId, requestId, ts: parsed.ts })
  )
  return timingSafeEqualHex(expected, parsed.v1)
}
