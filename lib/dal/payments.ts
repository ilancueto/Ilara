import 'server-only'

import { createSupabasePublicClient } from '@/lib/supabase/public'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { createOrderErrorFromRpc } from '@/lib/domain/orders/createOrder'
import { AppError } from '@/lib/domain/errors'
import type { PublicFollowView, PublicPaymentView } from '@/lib/domain/payments/types'
import {
  PAYMENT_RECEIPT_MAX_BYTES,
  detectPaymentReceiptMime,
  receiptExtensionForMime,
  validatePaymentReceiptMetadata,
  type PaymentReceiptFileMetadata,
} from '@/lib/domain/payments/receiptFile'
import type { PreparedReceiptUpload } from '@/lib/domain/payments/browserReceiptUpload'

export type { PublicPaymentView }

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

export async function startMercadoPagoCheckoutServer(input: {
  access_capability?: string
  follow_token?: string
  order_number?: string
  idempotency_key: string
}): Promise<{ checkout_url: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !anon) {
    throw new AppError('unknown', 'No se pudo abrir el pago. Intentá de nuevo.', { message: 'missing_public_env' })
  }
  const response = await fetch(`${url}/functions/v1/payments-mp-preference`, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...(input.follow_token
        ? { follow_token: input.follow_token, order_number: input.order_number }
        : { access_capability: input.access_capability }),
      idempotency_key: input.idempotency_key,
    }),
    cache: 'no-store',
  })
  const payload = record(await response.json().catch(() => ({})))
  const checkout = String(payload.checkout_url || '')
  if (!response.ok || !checkout.startsWith('https://')) {
    if (payload.code === 'payments_disabled') {
      throw createOrderErrorFromRpc('payments_disabled')
    }
    if (payload.code === 'mp_amount_too_low') {
      throw createOrderErrorFromRpc('mp_amount_too_low')
    }
    throw new AppError('unknown', 'No se pudo abrir Mercado Pago. Intentá de nuevo.', {
      message: 'mp_preference_failed',
      retryable: true,
    })
  }
  return { checkout_url: checkout }
}

export async function startBankTransferPaymentServer(input: {
  access_capability?: string
  follow_token?: string
  order_number?: string
  idempotency_key: string
}) {
  const supabase = createSupabasePublicClient()
  const { data, error } = await supabase.rpc('start_catalog_order_payment', {
    p_payload: {
      ...(input.follow_token
        ? { follow_token: input.follow_token, order_number: input.order_number }
        : { access_capability: input.access_capability }),
      method: 'bank_transfer',
      idempotency_key: input.idempotency_key,
    },
  })
  if (error) throw createOrderErrorFromRpc(error.message || '')
  return record(data)
}

export async function getPublicPaymentServer(accessCapability: string): Promise<PublicPaymentView> {
  const supabase = createSupabasePublicClient()
  const { data, error } = await supabase.rpc('get_catalog_payment_public', {
    p_access_capability: accessCapability,
  })
  if (error) throw createOrderErrorFromRpc(error.message || '')
  return mapPublicPaymentView(record(data))
}

function mapPublicPaymentView(raw: Record<string, unknown>): PublicPaymentView {
  const bank = raw.bank && typeof raw.bank === 'object' ? record(raw.bank) : null
  return {
    order_number: String(raw.order_number || ''),
    order_status: String(raw.order_status || ''),
    payment_status: raw.payment_status == null ? null : String(raw.payment_status),
    method: raw.method == null ? null : String(raw.method),
    amount_due: raw.amount_due == null ? null : Number(raw.amount_due),
    base_amount: raw.base_amount == null ? null : Number(raw.base_amount),
    quoted_base_amount: raw.quoted_base_amount == null ? null : Number(raw.quoted_base_amount),
    quoted_public_amount: raw.quoted_public_amount == null ? null : Number(raw.quoted_public_amount),
    transfer_available: raw.transfer_available === true,
    mp_available: raw.mp_available === true,
    checkout_url: raw.checkout_url == null ? null : String(raw.checkout_url),
    currency: String(raw.currency || 'ARS'),
    expires_at: raw.expires_at == null ? null : String(raw.expires_at),
    has_receipt: raw.has_receipt === true,
    can_retry: raw.can_retry === true,
    bank: bank
      ? {
          cbu: bank.cbu == null ? null : String(bank.cbu),
          alias: bank.alias == null ? null : String(bank.alias),
          bank_name: bank.bank_name == null ? null : String(bank.bank_name),
          account_holder: bank.account_holder == null ? null : String(bank.account_holder),
          cuit: bank.cuit == null ? null : String(bank.cuit),
          instructions: bank.instructions == null ? null : String(bank.instructions),
        }
      : null,
  }
}

export async function getPublicFollowServer(
  orderNumber: string,
  followToken: string
): Promise<PublicFollowView> {
  const supabase = createSupabasePublicClient()
  const { data, error } = await supabase.rpc('get_catalog_order_follow', {
    p_order_number: orderNumber,
    p_follow_token: followToken,
  })
  if (error) throw createOrderErrorFromRpc(error.message || '')
  const raw = record(data)
  return {
    ...mapPublicPaymentView(raw),
    fulfillment_mode: String(raw.fulfillment_mode || 'envio'),
    shipping_amount: Number(raw.shipping_amount) || 0,
    shipping_carrier: raw.shipping_carrier == null ? null : String(raw.shipping_carrier),
    shipping_service: raw.shipping_service == null ? null : String(raw.shipping_service),
    shipping_delivery_estimate:
      raw.shipping_delivery_estimate == null ? null : String(raw.shipping_delivery_estimate),
    can_pay: raw.can_pay === true,
  }
}

function receiptValidationError(error: unknown): AppError {
  const code = error instanceof Error ? error.message : 'invalid_receipt'
  return new AppError('validation', 'Elegí un JPG, PNG, WebP o PDF de hasta 5 MB.', { message: code })
}

async function createSignedReceiptUpload(
  prepared: { data: unknown; error: { message?: string } | null },
  metadata: PaymentReceiptFileMetadata
): Promise<PreparedReceiptUpload> {
  if (prepared.error) throw createOrderErrorFromRpc(prepared.error.message || '')
  const row = record(prepared.data)
  const path = String(row.storage_path || '')
  const expectedMime = String(row.expected_mime || '')
  if (!path || expectedMime !== metadata.type.toLowerCase()) {
    throw new AppError('unknown', 'No se pudo preparar el comprobante.', { message: 'receipt_path' })
  }
  const service = createSupabaseServiceClient()
  const signed = await service.storage.from('payment-receipts').createSignedUploadUrl(path)
  if (signed.error || !signed.data?.token) {
    await service.from('payment_receipt_uploads').delete().eq('storage_path', path)
    throw new AppError('unknown', 'No se pudo preparar el comprobante.', { message: 'receipt_sign' })
  }
  return {
    path,
    token: signed.data.token,
    contentType: expectedMime,
    maxBytes: PAYMENT_RECEIPT_MAX_BYTES,
  }
}

export async function prepareTransferReceiptUploadServer(
  accessCapability: string,
  metadata: PaymentReceiptFileMetadata
): Promise<PreparedReceiptUpload> {
  let valid: ReturnType<typeof validatePaymentReceiptMetadata>
  try {
    valid = validatePaymentReceiptMetadata(metadata)
  } catch (error) {
    throw receiptValidationError(error)
  }
  const service = createSupabaseServiceClient()
  const prepared = await service.rpc('prepare_transfer_receipt', {
    p_access_capability: accessCapability,
    p_extension: valid.extension,
  })
  return createSignedReceiptUpload(prepared, { ...metadata, type: valid.mime })
}

export async function prepareTransferReceiptFollowUploadServer(
  orderNumber: string,
  followToken: string,
  metadata: PaymentReceiptFileMetadata
): Promise<PreparedReceiptUpload> {
  let valid: ReturnType<typeof validatePaymentReceiptMetadata>
  try {
    valid = validatePaymentReceiptMetadata(metadata)
  } catch (error) {
    throw receiptValidationError(error)
  }
  const service = createSupabaseServiceClient()
  const prepared = await service.rpc('prepare_transfer_receipt_follow', {
    p_order_number: orderNumber,
    p_follow_token: followToken,
    p_extension: valid.extension,
  })
  return createSignedReceiptUpload(prepared, { ...metadata, type: valid.mime })
}

async function inspectAndCompleteReceipt(
  path: string,
  complete: (input: { mime: string; size: number; sha256: string }) => Promise<{ data: unknown; error: { message?: string } | null }>
): Promise<Record<string, unknown>> {
  if (!/^[0-9a-f-]{36}\/[0-9a-f]{32}\.(jpg|png|webp|pdf)$/.test(path)) {
    throw receiptValidationError(new Error('invalid_receipt_path'))
  }
  const service = createSupabaseServiceClient()
  const reservation = await service
    .from('payment_receipt_uploads')
    .select('payment_id, expected_mime, expires_at, completed_at')
    .eq('storage_path', path)
    .maybeSingle()
  if (reservation.error || !reservation.data || reservation.data.completed_at
    || new Date(reservation.data.expires_at).getTime() <= Date.now()) {
    throw receiptValidationError(new Error('invalid_receipt_upload'))
  }
  const downloaded = await service.storage.from('payment-receipts').download(path)
  if (downloaded.error || !downloaded.data) {
    throw new AppError('unknown', 'No se pudo leer el comprobante.', { message: 'receipt_download' })
  }
  const bytes = new Uint8Array(await downloaded.data.arrayBuffer())
  const mime = detectPaymentReceiptMime(bytes)
  const expectedExtension = mime ? receiptExtensionForMime(mime) : ''
  const actualExtension = path.split('.').pop() || ''
  if (!mime || mime !== reservation.data.expected_mime || expectedExtension !== actualExtension
    || bytes.length <= 0 || bytes.length > PAYMENT_RECEIPT_MAX_BYTES) {
    await service.storage.from('payment-receipts').remove([path])
    throw receiptValidationError(new Error('invalid_receipt_contents'))
  }
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  const previous = await service
    .from('payment_receipts')
    .select('storage_path')
    .eq('payment_id', reservation.data.payment_id)
    .maybeSingle()
  const done = await complete({ mime, size: bytes.length, sha256 })
  if (done.error) {
    await service.storage.from('payment-receipts').remove([path])
    throw createOrderErrorFromRpc(done.error.message || '')
  }
  const oldPath = previous.data?.storage_path
  if (oldPath && oldPath !== path) {
    await service.storage.from('payment-receipts').remove([oldPath])
  }
  return record(done.data)
}

export async function completeTransferReceiptUploadServer(accessCapability: string, path: string) {
  const service = createSupabaseServiceClient()
  const data = await inspectAndCompleteReceipt(path, async ({ mime, size, sha256 }) => await service.rpc('complete_transfer_receipt', {
    p_access_capability: accessCapability,
    p_storage_path: path,
    p_mime_type: mime,
    p_byte_size: size,
    p_sha256: sha256,
  }))
  const view = await getPublicPaymentServer(accessCapability).catch(() => null)
  if (view?.order_number) {
    const { notifyPaymentPendingByOrderNumber } = await import('@/lib/domain/orders/sendOrderEmail')
    await notifyPaymentPendingByOrderNumber(view.order_number)
  }
  return data
}

export async function completeTransferReceiptFollowUploadServer(
  orderNumber: string,
  followToken: string,
  path: string
) {
  const service = createSupabaseServiceClient()
  const data = await inspectAndCompleteReceipt(path, async ({ mime, size, sha256 }) => await service.rpc('complete_transfer_receipt_follow', {
    p_order_number: orderNumber,
    p_follow_token: followToken,
    p_storage_path: path,
    p_mime_type: mime,
    p_byte_size: size,
    p_sha256: sha256,
  }))
  const { notifyPaymentPendingByOrderNumber } = await import('@/lib/domain/orders/sendOrderEmail')
  await notifyPaymentPendingByOrderNumber(orderNumber)
  return data
}
