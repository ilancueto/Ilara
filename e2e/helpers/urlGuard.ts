/**
 * Guard de URL para E2E mutantes (Stage 4).
 * Solo permite Supabase CLI en loopback explícito.
 * No imprime ni registra la URL completa en errores (evita keys en query).
 */

const PROD_PROJECT_REF = 'qbbnvdmadgomfmrsfxlo'

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

/**
 * True solo para http(s)://127.0.0.1|localhost|::1[:port][/path...]
 * Rechaza HTTPS remoto, subdominios, prod ref, hosts no loopback, esquemas raros.
 */
export function isAllowedE2ESupabaseUrl(raw: string): boolean {
  const input = raw.trim()
  if (!input) return false

  // Rechazo rápido del proyecto productivo (cualquier casing / path / query)
  if (input.toLowerCase().includes(PROD_PROJECT_REF)) return false

  let parsed: URL
  try {
    parsed = new URL(input)
  } catch {
    return false
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false

  const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!LOOPBACK_HOSTS.has(host)) return false

  // Sin userinfo (evita https://user:pass@localhost)
  if (parsed.username || parsed.password) return false

  return true
}

/** Lanza con mensaje genérico (sin volcar URL/keys). */
export function assertAllowedE2ESupabaseUrl(raw: string): void {
  if (!isAllowedE2ESupabaseUrl(raw)) {
    throw new Error(
      'E2E mutante bloqueado: la URL de Supabase no es loopback local permitido (solo http(s)://127.0.0.1|localhost).'
    )
  }
}

export { PROD_PROJECT_REF }
