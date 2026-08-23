'use client'

import { getBrowserSupabase } from '@/lib/supabase/browser'
import {
  validatePaymentReceiptMetadata,
  type PaymentReceiptFileMetadata,
} from '@/lib/domain/payments/receiptFile'

export type PreparedReceiptUpload = {
  path: string
  token: string
  contentType: string
  maxBytes: number
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

export async function uploadPaymentReceiptDirect(
  file: File,
  prepare: (metadata: PaymentReceiptFileMetadata) => Promise<Result<PreparedReceiptUpload>>,
  complete: (path: string) => Promise<Result<Record<string, unknown>>>
): Promise<Result<Record<string, unknown>>> {
  try {
    validatePaymentReceiptMetadata({ name: file.name, size: file.size, type: file.type })
  } catch {
    return { ok: false, error: 'Elegí un JPG, PNG, WebP o PDF de hasta 5 MB.' }
  }

  const prepared = await prepare({ name: file.name, size: file.size, type: file.type })
  if (!prepared.ok) return prepared
  const { path, token, contentType } = prepared.data
  const uploaded = await getBrowserSupabase().storage
    .from('payment-receipts')
    .uploadToSignedUrl(path, token, file, {
      contentType,
      cacheControl: 'private, max-age=0',
    })
  if (uploaded.error) {
    return { ok: false, error: 'No se pudo subir el comprobante. Intentá de nuevo.' }
  }
  return complete(path)
}
