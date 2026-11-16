'use server'

import {
  getPublicFollowServer,
  getPublicPaymentServer,
  completeTransferReceiptFollowUploadServer,
  completeTransferReceiptUploadServer,
  prepareTransferReceiptFollowUploadServer,
  prepareTransferReceiptUploadServer,
  startBankTransferPaymentServer,
  startMercadoPagoCheckoutServer,
} from '@/lib/dal/payments'
import type { PublicFollowView, PublicPaymentView } from '@/lib/domain/payments/types'
import type { PaymentReceiptFileMetadata } from '@/lib/domain/payments/receiptFile'
import type { PreparedReceiptUpload } from '@/lib/domain/payments/browserReceiptUpload'
import { isAppError, toUserMessage } from '@/lib/domain/errors'
import { createHmac } from 'node:crypto'
import { headers } from 'next/headers'
import { isOrderNumber, normalizeOrderNumber } from '@/lib/domain/orders/followLink'
import { getOrderAccessDerivationSecret } from '@/lib/domain/payments/orderAccess'
import { readOrderFollowCookie, setOrderFollowCookie } from '@/lib/domain/orders/followSession'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { createOrderNotificationUrl } from '@/lib/domain/orders/sendOrderEmail'

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

export async function startMercadoPagoAction(
  accessCapability: string,
  idempotencyKey: string
): Promise<ActionResult<{ checkout_url: string }>> {
  try {
    const data = await startMercadoPagoCheckoutServer({
      access_capability: accessCapability,
      idempotency_key: idempotencyKey,
    })
    return { ok: true, data }
  } catch (error) {
    return { ok: false, error: toUserMessage(error, 'No se pudo iniciar el pago.') }
  }
}

export async function startBankTransferAction(
  accessCapability: string,
  idempotencyKey: string
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const data = await startBankTransferPaymentServer({
      access_capability: accessCapability,
      idempotency_key: idempotencyKey,
    })
    return { ok: true, data }
  } catch (error) {
    return { ok: false, error: toUserMessage(error, 'No se pudo iniciar el pago.') }
  }
}

export async function getPublicPaymentAction(
  accessCapability: string
): Promise<ActionResult<PublicPaymentView>> {
  try {
    return { ok: true, data: await getPublicPaymentServer(accessCapability) }
  } catch (error) {
    return { ok: false, error: toUserMessage(error, 'No encontramos ese pedido.') }
  }
}

export async function claimFollowSessionAction(
  orderNumber: string,
  token: string
): Promise<ActionResult<PublicFollowView>> {
  try {
    if (!isOrderNumber(orderNumber) || token.trim().length < 32) {
      return { ok: false, error: 'Este enlace ya no sirve. Armá el pedido de nuevo si todavía lo querés.' }
    }
    const data = await getPublicFollowServer(orderNumber.trim(), token.trim())
    await setOrderFollowCookie(orderNumber.trim(), token.trim())
    return { ok: true, data }
  } catch (error) {
    return { ok: false, error: toUserMessage(error, 'Este enlace ya no sirve. Armá el pedido de nuevo si todavía lo querés.') }
  }
}

export async function claimNotificationSessionAction(
  orderNumber: string,
  token: string
): Promise<ActionResult<PublicFollowView>> {
  try {
    if (!isOrderNumber(orderNumber) || token.trim().length < 32) {
      return { ok: false, error: 'Este enlace venció o ya fue usado.' }
    }
    const redeemed = await createSupabaseServiceClient().rpc('redeem_order_notification_link', {
      p_order_number: orderNumber.trim(),
      p_plain: token.trim(),
    })
    const row = redeemed.data && typeof redeemed.data === 'object'
      ? redeemed.data as Record<string, unknown>
      : {}
    const followToken = String(row.follow_token || '')
    if (redeemed.error || followToken.length < 32) {
      return { ok: false, error: 'Este enlace venció o ya fue usado.' }
    }
    const data = await getPublicFollowServer(orderNumber.trim(), followToken)
    await setOrderFollowCookie(orderNumber.trim(), followToken)
    return { ok: true, data }
  } catch {
    return { ok: false, error: 'Este enlace venció o ya fue usado.' }
  }
}

/** Identificador anónimo del cliente para el límite de intentos (no guarda la IP). */
async function lookupClientHash(): Promise<string> {
  const list = await headers()
  const ip = (list.get('x-forwarded-for') || list.get('x-real-ip') || 'sin-ip').split(',')[0].trim()
  const agent = (list.get('user-agent') || '').slice(0, 200)
  return createHmac('sha256', getOrderAccessDerivationSecret()).update(`order-lookup:v1:${ip}:${agent}`).digest('hex')
}

/**
 * "Seguir mi pedido": número de pedido + teléfono. Si coinciden, abre una sesión de seguimiento
 * en este navegador (misma cookie que el link del pedido). Mismo mensaje si no existe o no coincide.
 */
export async function lookupOrderAction(
  orderNumberInput: string,
  phoneInput: string
): Promise<ActionResult<{ orderNumber: string }>> {
  const notFound = 'No encontramos un pedido con esos datos. Revisá el código y el teléfono.'
  try {
    const orderNumber = normalizeOrderNumber(orderNumberInput || '')
    const phone = String(phoneInput || '').replace(/[^0-9]/g, '')
    if (!isOrderNumber(orderNumber) || phone.length < 8) return { ok: false, error: notFound }
    const service = createSupabaseServiceClient()
    const verified = await service.rpc('verify_order_lookup', {
      p_order_number: orderNumber,
      p_phone: phone,
      p_client_hash: await lookupClientHash(),
    })
    const result = (verified.data ?? {}) as { ok?: boolean; reason?: string }
    if (verified.error) return { ok: false, error: 'No pudimos buscar el pedido. Probá de nuevo en unos minutos.' }
    if (result.reason === 'rate_limited') {
      return { ok: false, error: 'Hiciste muchos intentos. Esperá unos minutos y probá de nuevo.' }
    }
    if (!result.ok) return { ok: false, error: notFound }
    const issued = await service.rpc('create_order_notification_link', { p_order_number: orderNumber, p_kind: 'lookup' })
    const token = String((issued.data as { token?: string } | null)?.token || '')
    if (issued.error || token.length < 32) return { ok: false, error: 'No pudimos abrir el pedido. Probá de nuevo.' }
    const claimed = await claimNotificationSessionAction(orderNumber, token)
    if (!claimed.ok) return { ok: false, error: 'No pudimos abrir el pedido. Probá de nuevo.' }
    return { ok: true, data: { orderNumber } }
  } catch {
    return { ok: false, error: 'No pudimos buscar el pedido. Probá de nuevo en unos minutos.' }
  }
}

export async function createFollowShareLinkAction(
  orderNumber: string
): Promise<ActionResult<{ url: string }>> {
  try {
    const token = await readOrderFollowCookie(orderNumber)
    if (!token) return { ok: false, error: 'Volvé a abrir el seguimiento del pedido.' }
    await getPublicFollowServer(orderNumber, token)
    const url = await createOrderNotificationUrl(orderNumber, 'whatsapp_manual')
    return url ? { ok: true, data: { url } } : { ok: false, error: 'No se pudo preparar el enlace.' }
  } catch {
    return { ok: false, error: 'No se pudo preparar el enlace.' }
  }
}

export async function getFollowOrderAction(
  orderNumber: string
): Promise<ActionResult<PublicFollowView>> {
  try {
    const token = await readOrderFollowCookie(orderNumber)
    if (!token) {
      return { ok: false, error: 'Este enlace ya no sirve. Armá el pedido de nuevo si todavía lo querés.' }
    }
    return { ok: true, data: await getPublicFollowServer(orderNumber, token) }
  } catch (error) {
    return { ok: false, error: toUserMessage(error, 'Este enlace ya no sirve. Armá el pedido de nuevo si todavía lo querés.') }
  }
}

export async function startFollowMercadoPagoAction(
  orderNumber: string,
  idempotencyKey: string
): Promise<ActionResult<{ checkout_url: string }>> {
  try {
    const token = await readOrderFollowCookie(orderNumber)
    if (!token) {
      return { ok: false, error: 'Este enlace ya no sirve. Armá el pedido de nuevo si todavía lo querés.' }
    }
    const data = await startMercadoPagoCheckoutServer({
      follow_token: token,
      order_number: orderNumber,
      idempotency_key: idempotencyKey,
    })
    return { ok: true, data }
  } catch (error) {
    return { ok: false, error: toUserMessage(error, 'No se pudo iniciar el pago.') }
  }
}

export async function startFollowBankTransferAction(
  orderNumber: string,
  idempotencyKey: string
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const token = await readOrderFollowCookie(orderNumber)
    if (!token) {
      return { ok: false, error: 'Este enlace ya no sirve. Armá el pedido de nuevo si todavía lo querés.' }
    }
    const data = await startBankTransferPaymentServer({
      follow_token: token,
      order_number: orderNumber,
      idempotency_key: idempotencyKey,
    })
    return { ok: true, data }
  } catch (error) {
    return { ok: false, error: toUserMessage(error, 'No se pudo iniciar el pago.') }
  }
}

export async function prepareFollowTransferReceiptUploadAction(
  orderNumber: string,
  metadata: PaymentReceiptFileMetadata
): Promise<ActionResult<PreparedReceiptUpload>> {
  try {
    const token = await readOrderFollowCookie(orderNumber)
    if (!token) {
      return { ok: false, error: 'Este enlace ya no sirve. Armá el pedido de nuevo si todavía lo querés.' }
    }
    return { ok: true, data: await prepareTransferReceiptFollowUploadServer(orderNumber, token, metadata) }
  } catch (error) {
    return {
      ok: false,
      error: isAppError(error) ? error.userMessage : 'No se pudo enviar el comprobante.',
    }
  }
}

export async function completeFollowTransferReceiptUploadAction(
  orderNumber: string,
  path: string
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const token = await readOrderFollowCookie(orderNumber)
    if (!token) return { ok: false, error: 'Este enlace ya no sirve. Armá el pedido de nuevo si todavía lo querés.' }
    return { ok: true, data: await completeTransferReceiptFollowUploadServer(orderNumber, token, path) }
  } catch (error) {
    return { ok: false, error: isAppError(error) ? error.userMessage : 'No se pudo enviar el comprobante.' }
  }
}

export async function prepareTransferReceiptUploadAction(
  accessCapability: string,
  metadata: PaymentReceiptFileMetadata
): Promise<ActionResult<PreparedReceiptUpload>> {
  try {
    return { ok: true, data: await prepareTransferReceiptUploadServer(accessCapability, metadata) }
  } catch (error) {
    return {
      ok: false,
      error: isAppError(error) ? error.userMessage : 'No se pudo enviar el comprobante.',
    }
  }
}

export async function completeTransferReceiptUploadAction(
  accessCapability: string,
  path: string
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    return { ok: true, data: await completeTransferReceiptUploadServer(accessCapability, path) }
  } catch (error) {
    return { ok: false, error: isAppError(error) ? error.userMessage : 'No se pudo enviar el comprobante.' }
  }
}
