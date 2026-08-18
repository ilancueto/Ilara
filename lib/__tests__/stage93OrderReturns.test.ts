import { describe, expect, it } from 'vitest'
import {
  catalogRefundActionLabel,
  catalogReturnLabel,
  previewRefundAmount,
} from '@/lib/domain/returns/rules'
import { mapReturnableOrders, parseCreateOrderReturnResult, saleReturnErrorFromRpc } from '@/lib/domain/returns/mappers'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sql = readFileSync(
  join(__dirname, '../../supabase/migrations/20260818025000_stage93_order_returns.sql'),
  'utf8'
)

describe('Stage 9.3 devoluciones de catálogo', () => {
  it('usa modelo propio y no toca sale_returns ni sales', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.order_returns')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.order_return_items')
    expect(sql).toContain('create_order_return')
    expect(sql).not.toContain('INSERT INTO public.sales')
    expect(sql).not.toContain('INSERT INTO public.sale_returns')
    expect(sql).not.toContain('INSERT INTO public.incomes')
  })

  it('reintegra stock una vez y no reembolsa dinero por defecto', () => {
    expect(sql).toContain("apply_payment_refund")
    expect(sql).toContain('v_apply_refund := coalesce((p_payload->>\'apply_payment_refund\')::boolean, false)')
    expect(sql).toContain('return_quantity_exceeds_available')
    expect(sql).toContain('admin_refund_catalog_payment')
  })

  it('oculta líneas agotadas y prorratea el subtotal', () => {
    const orders = mapReturnableOrders([{
      id: 'o1',
      order_number: 'IL-000011',
      created_at: '2026-08-17',
      customer_name: 'Mara',
      customer_id: 3,
      total: 300,
      status: 'confirmed',
      stock_reserved: true,
      order_items: [
        { id: 10, product_id: 1, name_snapshot: 'A', quantity: 2, unit_price: 100, line_subtotal: 200 },
        { id: 11, product_id: 2, name_snapshot: 'B', quantity: 1, unit_price: 100, line_subtotal: 100 },
      ],
    }], [
      { order_item_id: 10, quantity: 1 },
      { order_item_id: 11, quantity: 1 },
    ])
    expect(orders[0].items).toHaveLength(1)
    expect(orders[0].items[0].available_quantity).toBe(1)
    expect(previewRefundAmount(orders[0].items[0], 1)).toBe(100)
  })

  it('mapea resultado y errores sin jerga', () => {
    const result = parseCreateOrderReturnResult({
      id: 'r1', return_number: '4', order_id: 'o1', refund_total: '250', restock: true, refund_action: 'record_manual',
    })
    expect(catalogReturnLabel(result.return_number)).toBe('DEV-000004')
    expect(catalogRefundActionLabel(result.refund_action)).toContain('transferencia')
    expect(saleReturnErrorFromRpc('return_quantity_exceeds_available').code).toBe('conflict')
    expect(saleReturnErrorFromRpc('stock_not_reserved').userMessage).not.toMatch(/rpc|stock_reserved/i)
  })
})
