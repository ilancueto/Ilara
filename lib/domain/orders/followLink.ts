import { getShareAbsoluteUrl } from '@/lib/site'

export const FOLLOW_COOKIE_PREFIX = 'ilara_pedido_'
export const FOLLOW_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

/** Pedidos viejos: IL-000123. Nuevos: ILARA- + 6 caracteres sin 0/O/1/I/L. */
const ORDER_NUMBER_RE = /^(IL-[0-9]{6,}|ILARA-[2-9A-HJKMNP-Z]{6})$/

export function isOrderNumber(value: string): boolean {
  return ORDER_NUMBER_RE.test(value.trim())
}

/**
 * Normaliza lo que escribe la clienta: mayúsculas, sin espacios, con guion.
 * "ilara 7k3qpx", "ILARA7K3QPX" o solo "7K3QPX" → "ILARA-7K3QPX"; "il-000123" → "IL-000123".
 */
export function normalizeOrderNumber(value: string): string {
  const compact = value.toUpperCase().replace(/[\s_.]+/g, '').replace(/^#/, '')
  if (/^IL-?[0-9]{6,}$/.test(compact)) return compact.replace(/^IL-?/, 'IL-')
  const code = compact.replace(/^ILARA-?/, '')
  if (/^[0-9A-Z]{6}$/.test(code)) return `ILARA-${code}`
  return compact
}

export function followCookieName(orderNumber: string): string {
  return `${FOLLOW_COOKIE_PREFIX}${orderNumber.trim()}`
}

export function buildOrderFollowPath(orderNumber: string, token: string): string {
  const number = orderNumber.trim()
  return `/pedido/${encodeURIComponent(number)}?t=${encodeURIComponent(token)}`
}

export function buildOrderFollowUrl(orderNumber: string, token: string): string {
  return getShareAbsoluteUrl(buildOrderFollowPath(orderNumber, token))
}

export function buildOrderNotificationPath(orderNumber: string, token: string): string {
  return `/pedido/${encodeURIComponent(orderNumber.trim())}?n=${encodeURIComponent(token)}`
}

export function buildOrderNotificationUrl(orderNumber: string, token: string): string {
  return getShareAbsoluteUrl(buildOrderNotificationPath(orderNumber, token))
}

export function buildOrderFollowCleanPath(orderNumber: string): string {
  return `/pedido/${encodeURIComponent(orderNumber.trim())}`
}
