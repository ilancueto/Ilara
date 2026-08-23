import { describe, expect, it } from 'vitest'
import {
  PAYMENT_RECEIPT_MAX_BYTES,
  detectPaymentReceiptMime,
  validatePaymentReceiptMetadata,
} from '@/lib/domain/payments/receiptFile'

describe('comprobantes de transferencia', () => {
  it('valida tipo, extensión y límite antes de firmar', () => {
    expect(validatePaymentReceiptMetadata({ name: 'pago.JPEG', size: 1200, type: 'image/jpeg' }))
      .toEqual({ mime: 'image/jpeg', extension: 'jpg' })
    expect(() => validatePaymentReceiptMetadata({ name: 'pago.exe', size: 10, type: 'image/png' }))
      .toThrow('invalid_receipt_extension')
    expect(() => validatePaymentReceiptMetadata({ name: 'pago.pdf', size: PAYMENT_RECEIPT_MAX_BYTES + 1, type: 'application/pdf' }))
      .toThrow('invalid_receipt_size')
  })

  it('detecta el contenido real por magic bytes', () => {
    expect(detectPaymentReceiptMime(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg')
    expect(detectPaymentReceiptMime(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe('image/png')
    expect(detectPaymentReceiptMime(new TextEncoder().encode('%PDF-1.7'))).toBe('application/pdf')
    expect(detectPaymentReceiptMime(new TextEncoder().encode('contenido cualquiera'))).toBeNull()
  })
})
