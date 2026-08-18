import 'server-only'

import { cookies } from 'next/headers'
import { FOLLOW_COOKIE_MAX_AGE, followCookieName, isOrderNumber } from '@/lib/domain/orders/followLink'

export async function setOrderFollowCookie(orderNumber: string, token: string): Promise<void> {
  if (!isOrderNumber(orderNumber) || !token) return
  const jar = await cookies()
  jar.set(followCookieName(orderNumber), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/pedido',
    maxAge: FOLLOW_COOKIE_MAX_AGE,
  })
}

export async function readOrderFollowCookie(orderNumber: string): Promise<string | null> {
  if (!isOrderNumber(orderNumber)) return null
  const jar = await cookies()
  const value = jar.get(followCookieName(orderNumber))?.value?.trim() || ''
  return value.length >= 32 ? value : null
}
