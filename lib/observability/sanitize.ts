/**
 * Sanitización de payloads de observabilidad (Stage 4 / OBS-01).
 *
 * Límites reales (regex, no anonimización perfecta):
 * - Claves sensibles por nombre (substring).
 * - Valores con JWT, Bearer, emails, teléfonos largos, prefijos de keys.
 * - Truncado de profundidad/longitud.
 * - No garantiza cubrir ofuscación creativa ni PII en campos con nombres inocentes
 *   (p.ej. `label: "Juan Pérez"`). Preferir no loguear payloads de negocio.
 */

const REDACTED = '[REDACTED]'

const SENSITIVE_KEY_RE =
  /(password|passwd|pwd|secret|token|authorization|cookie|set-cookie|api[_-]?key|service[_-]?role|anon[_-]?key|refresh[_-]?token|access[_-]?token|bearer|email|phone|tel|telefono|customer|receipt|comprobante|notes|notas|ssn|dni|cuit|card|cvv|pan|address|direccion|first_name|last_name|full_name|nombre|apellido|payment_breakdown|unit_price)/i

const SENSITIVE_VALUE_RE =
  /(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.|Bearer\s+\S+|sk_live_|sk_test_|service_role|sbp_|sb_secret_|sb_publishable_|-----BEGIN|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|(?:\+?54[\s.-]?)?(?:\(?0?11\)?|\(?\d{2,4}\)?)[\s.-]?\d{3,4}[\s.-]?\d{4}|\+?\d[\d\s\-().]{8,}\d)/i

const MAX_STRING = 500
const MAX_DEPTH = 4
const MAX_KEYS = 40

export type SanitizeOptions = {
  maxString?: number
  maxDepth?: number
  maxKeys?: number
}

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_RE.test(key.trim())
}

export function sanitizeString(value: string, max = MAX_STRING): string {
  if (SENSITIVE_VALUE_RE.test(value)) return REDACTED
  // Query strings con tokens típicos
  if (/(?:access_token|refresh_token|token|apikey|service_role)=/i.test(value)) {
    return REDACTED
  }
  if (value.length > max) return `${value.slice(0, max)}…`
  return value
}

export function sanitizeForTelemetry(
  input: unknown,
  options: SanitizeOptions = {},
  depth = 0
): unknown {
  const maxString = options.maxString ?? MAX_STRING
  const maxDepth = options.maxDepth ?? MAX_DEPTH
  const maxKeys = options.maxKeys ?? MAX_KEYS

  if (input == null) return input
  if (typeof input === 'string') return sanitizeString(input, maxString)
  if (typeof input === 'number' || typeof input === 'boolean') return input
  if (typeof input === 'bigint') return String(input)
  if (typeof input === 'function' || typeof input === 'symbol') return undefined
  if (input instanceof Error) {
    return {
      name: input.name,
      message: sanitizeString(input.message, maxString),
      ...(process.env.NODE_ENV === 'development' && input.stack
        ? { stack: sanitizeString(input.stack, 2000) }
        : {}),
    }
  }
  if (depth >= maxDepth) return '[Truncated]'

  if (Array.isArray(input)) {
    return input.slice(0, 20).map((item) => sanitizeForTelemetry(item, options, depth + 1))
  }

  if (typeof input === 'object') {
    const out: Record<string, unknown> = {}
    const entries = Object.entries(input as Record<string, unknown>).slice(0, maxKeys)
    for (const [key, value] of entries) {
      if (isSensitiveKey(key)) {
        out[key] = REDACTED
        continue
      }
      out[key] = sanitizeForTelemetry(value, options, depth + 1)
    }
    return out
  }

  return sanitizeString(String(input), maxString)
}

/** Headers HTTP: allowlist estricta (nunca Authorization/Cookie). */
export function sanitizeHeaders(
  headers: Headers | Record<string, string | string[] | undefined> | null | undefined
): Record<string, string> {
  if (!headers) return {}
  const allow = new Set([
    'content-type',
    'x-request-id',
    'x-correlation-id',
    'user-agent',
    'accept',
  ])
  const out: Record<string, string> = {}
  const get = (name: string): string | null => {
    if (headers instanceof Headers) return headers.get(name)
    const v = (headers as Record<string, string | string[] | undefined>)[name]
    if (v == null) return null
    return Array.isArray(v) ? v.join(',') : v
  }
  for (const name of allow) {
    const raw = get(name)
    if (!raw) continue
    out[name] = sanitizeString(raw, 200)
  }
  if (get('x-forwarded-for')) out['x-forwarded-for'] = '[present]'
  if (get('authorization') || get('cookie') || get('set-cookie')) {
    out['sensitive-headers'] = '[present-redacted]'
  }
  return out
}
