import { getShareAbsoluteUrl } from '@/lib/site'

export const FOLLOW_COOKIE_PREFIX = 'ilara_pedido_'
export const FOLLOW_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

const ORDER_NUMBER_RE = /^IL-[0-9]{6,}$/

export function isOrderNumber(value: string): boolean {
  return ORDER_NUMBER_RE.test(value.trim())
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
