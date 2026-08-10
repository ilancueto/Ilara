import { describe, it, expect } from 'vitest'
import {
  receiptPathFromStored,
  validateReceiptFile,
  RECEIPT_MAX_BYTES,
  RECEIPT_SIGNED_URL_TTL_SEC,
} from '../receiptStorage'

describe('receiptStorage (Etapa 0 / STO-01)', () => {
  it('TTL firmado es corto', () => {
    expect(RECEIPT_SIGNED_URL_TTL_SEC).toBeLessThanOrEqual(600)
    expect(RECEIPT_SIGNED_URL_TTL_SEC).toBeGreaterThanOrEqual(60)
  })

  it('parsea path desde URL pública legacy y path plano', () => {
    expect(receiptPathFromStored('uid/sale-abc.jpg')).toBe('uid/sale-abc.jpg')
    expect(
      receiptPathFromStored(
        'https://xyz.supabase.co/storage/v1/object/public/receipts/uid/file.pdf'
      )
    ).toBe('uid/file.pdf')
  })

  it('valida MIME y tamaño', () => {
    const ok = new File([new Uint8Array(10)], 'a.jpg', { type: 'image/jpeg' })
    expect(validateReceiptFile(ok).ok).toBe(true)

    const badType = new File([new Uint8Array(10)], 'a.exe', { type: 'application/x-msdownload' })
    expect(validateReceiptFile(badType).ok).toBe(false)

    const big = new File([new Uint8Array(RECEIPT_MAX_BYTES + 1)], 'big.pdf', {
      type: 'application/pdf',
    })
    expect(validateReceiptFile(big).ok).toBe(false)
  })
})
