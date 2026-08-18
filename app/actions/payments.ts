'use server'

import {
  getPublicFollowServer,
  getPublicPaymentServer,
  startBankTransferPaymentServer,
  startMercadoPagoCheckoutServer,
  uploadTransferReceiptFollowServer,
  uploadTransferReceiptServer,
} from '@/lib/dal/payments'
import type { PublicFollowView, PublicPaymentView } from '@/lib/domain/payments/types'
import { isAppError, toUserMessage } from '@/lib/domain/errors'
import { isOrderNumber } from '@/lib/domain/orders/followLink'
import { readOrderFollowCookie, setOrderFollowCookie } from '@/lib/domain/orders/followSession'

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

export async function uploadFollowTransferReceiptAction(
  orderNumber: string,
  formData: FormData
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const token = await readOrderFollowCookie(orderNumber)
    if (!token) {
      return { ok: false, error: 'Este enlace ya no sirve. Armá el pedido de nuevo si todavía lo querés.' }
    }
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return { ok: false, error: 'Elegí una imagen o un PDF.' }
    }
    return { ok: true, data: await uploadTransferReceiptFollowServer(orderNumber, token, file) }
  } catch (error) {
    return {
      ok: false,
      error: isAppError(error) ? error.userMessage : 'No se pudo enviar el comprobante.',
    }
  }
}

export async function uploadTransferReceiptAction(
  accessCapability: string,
  formData: FormData
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return { ok: false, error: 'Elegí una imagen o un PDF.' }
    }
    return { ok: true, data: await uploadTransferReceiptServer(accessCapability, file) }
  } catch (error) {
    return {
      ok: false,
      error: isAppError(error) ? error.userMessage : 'No se pudo enviar el comprobante.',
    }
  }
}
