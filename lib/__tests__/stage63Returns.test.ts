import { describe, expect, it } from 'vitest'
import { creditNoteLabel, previewRefundAmount, refundMethodLabel } from '@/lib/domain/returns/rules'
import { mapReturnableSales, saleReturnErrorFromRpc } from '@/lib/domain/returns/mappers'

describe('Stage 6.3 return rules', () => {
  it('prorratea el subtotal histórico para una devolución parcial', () => {
    expect(previewRefundAmount({
      id: 1, product_id: 1, combo_id: null, product_name: 'A',
      quantity: 3, returned_quantity: 0, available_quantity: 3,
      unit_price: 100, subtotal: 270,
    }, 2)).toBe(180)
  })

  it('formatea número y forma de reintegro', () => {
    expect(creditNoteLabel(42)).toBe('NC-000042')
    expect(refundMethodLabel('credito_cancelado')).toBe('Cancelar saldo a crédito')
  })

  it('resta cantidades devueltas y oculta líneas agotadas', () => {
    const sales = mapReturnableSales([{
      id: 9, sale_date: '2026-01-01', created_at: '2026-01-01',
      customer_name: null, total: 300, status: 'completed', payment_method: 'efectivo',
      sale_items: [
        { id: 10, product_id: 1, combo_id: null, product_name: 'A', quantity: 2, unit_price: 100, subtotal: 200 },
        { id: 11, product_id: 2, combo_id: null, product_name: 'B', quantity: 1, unit_price: 100, subtotal: 100 },
      ],
    }], [
      { sale_item_id: 10, quantity: 1 },
      { sale_item_id: 11, quantity: 1 },
    ])
    expect(sales[0].items).toHaveLength(1)
    expect(sales[0].items[0].available_quantity).toBe(1)
  })

  it('mapea conflictos de cantidad a mensaje seguro', () => {
    const error = saleReturnErrorFromRpc('return_quantity_exceeds_available')
    expect(error.code).toBe('conflict')
    expect(error.userMessage).toContain('cantidad')
  })
})
