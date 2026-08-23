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
import { isOrderNumber } from '@/lib/domain/orders/followLink'
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
