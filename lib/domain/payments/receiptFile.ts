export const PAYMENT_RECEIPT_MAX_BYTES = 5 * 1024 * 1024

export const PAYMENT_RECEIPT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const

export type PaymentReceiptMime = (typeof PAYMENT_RECEIPT_MIME_TYPES)[number]

export type PaymentReceiptFileMetadata = {
  name: string
  size: number
  type: string
}

const EXTENSIONS: Record<PaymentReceiptMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

export function validatePaymentReceiptMetadata(input: PaymentReceiptFileMetadata): {
  mime: PaymentReceiptMime
  extension: string
} {
  if (!Number.isInteger(input.size) || input.size <= 0 || input.size > PAYMENT_RECEIPT_MAX_BYTES) {
    throw new Error('invalid_receipt_size')
  }
  const mime = input.type.trim().toLowerCase()
  if (!PAYMENT_RECEIPT_MIME_TYPES.includes(mime as PaymentReceiptMime)) {
    throw new Error('invalid_receipt_type')
  }
  const typedMime = mime as PaymentReceiptMime
  const nameExt = input.name.split('.').pop()?.toLowerCase() || ''
  const expected = EXTENSIONS[typedMime]
  if (typedMime === 'image/jpeg' ? !['jpg', 'jpeg'].includes(nameExt) : nameExt !== expected) {
    throw new Error('invalid_receipt_extension')
  }
  return { mime: typedMime, extension: expected }
}

export function detectPaymentReceiptMime(bytes: Uint8Array): PaymentReceiptMime | null {
  if (bytes.length >= 5 && new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-') {
    return 'application/pdf'
  }
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) {
    return 'image/png'
  }
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF'
    && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP') {
    return 'image/webp'
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  return null
}

export function receiptExtensionForMime(mime: PaymentReceiptMime): string {
  return EXTENSIONS[mime]
}

