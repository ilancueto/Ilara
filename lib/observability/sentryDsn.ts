/**
 * Utilidades puras sobre el DSN de Sentry (sin dependencias, importables desde next.config.ts).
 */

/** DSN configurado (cliente o servidor) o undefined si no hay. */
export function readSentryDsn(env: Record<string, string | undefined> = process.env): string | undefined {
  const dsn = env.SENTRY_DSN?.trim() || env.NEXT_PUBLIC_SENTRY_DSN?.trim()
  return dsn || undefined
}

/**
 * Origen de ingesta (https://oXXXX.ingest.sentry.io) para el `connect-src` del CSP.
 * Devuelve undefined si el DSN no es una URL https válida (nunca amplía el CSP por error).
 */
export function sentryIngestOrigin(dsn: string | undefined): string | undefined {
  if (!dsn) return undefined
  try {
    const url = new URL(dsn)
    if (url.protocol !== 'https:') return undefined
    return `https://${url.host}`
  } catch {
    return undefined
  }
}
