'use server'

import {
  getPublicPaymentServer,
  startBankTransferPaymentServer,
  startMercadoPagoCheckoutServer,
  uploadTransferReceiptServer,
} from '@/lib/dal/payments'
import type { PublicPaymentView } from '@/lib/domain/payments/types'
import { isAppError, toUserMessage } from '@/lib/domain/errors'

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
