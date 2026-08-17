import 'server-only'

import { createSupabasePublicClient } from '@/lib/supabase/public'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { createOrderErrorFromRpc } from '@/lib/domain/orders/createOrder'
import { AppError } from '@/lib/domain/errors'
import type { PublicPaymentView } from '@/lib/domain/payments/types'

export type { PublicPaymentView }

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

export async function startBankTransferPaymentServer(input: {
  access_capability: string
  idempotency_key: string
}) {
  const supabase = createSupabasePublicClient()
  const { data, error } = await supabase.rpc('start_catalog_order_payment', {
    p_payload: {
      access_capability: input.access_capability,
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
  const raw = record(data)
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

function extensionFor(file: File): string {
  const fromName = (file.name.split('.').pop() || '').toLowerCase()
  if (['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(fromName)) return fromName
  if (file.type === 'application/pdf') return 'pdf'
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

export async function uploadTransferReceiptServer(accessCapability: string, file: File) {
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
    throw new AppError('validation', 'El comprobante no puede superar 5 MB.', { message: 'invalid_receipt_size' })
  }
  const publicClient = createSupabasePublicClient()
  const prepared = await publicClient.rpc('prepare_transfer_receipt', {
    p_access_capability: accessCapability,
    p_extension: extensionFor(file),
  })
  if (prepared.error) throw createOrderErrorFromRpc(prepared.error.message || '')
  const path = String(record(prepared.data).storage_path || '')
  if (!path) throw new AppError('unknown', 'No se pudo guardar el comprobante.', { message: 'receipt_path' })

  const bytes = new Uint8Array(await file.arrayBuffer())
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const sha256 = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')

  const service = createSupabaseServiceClient()
  const upload = await service.storage.from('payment-receipts').upload(path, bytes, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (upload.error) {
    throw new AppError('unknown', 'No se pudo guardar el comprobante.', { message: 'receipt_upload' })
  }

  const done = await publicClient.rpc('complete_transfer_receipt', {
    p_access_capability: accessCapability,
    p_storage_path: path,
    p_mime_type: file.type || 'application/octet-stream',
    p_byte_size: file.size,
    p_sha256: sha256,
  })
  if (done.error) throw createOrderErrorFromRpc(done.error.message || '')
  return record(done.data)
}
