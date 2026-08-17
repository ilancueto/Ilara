/**
 * Autorización de tareas internas (Vercel Cron).
 * Vercel envía Authorization: Bearer $CRON_SECRET cuando la variable existe.
 */
function expectedCronSecret(): string | null {
  const secret = process.env.CRON_SECRET?.trim()
  return secret && secret.length >= 16 ? secret : null
}

export function authorizeInternalJob(request: Request): boolean {
  const expected = expectedCronSecret()
  if (!expected) return false
  const header = request.headers.get('authorization') || ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (bearer && bearer === expected) return true
  const headerSecret = request.headers.get('x-cron-secret')?.trim() || ''
  return headerSecret === expected
}

export function cronUnauthorizedResponse(): Response {
  return Response.json({ ok: false }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
}
