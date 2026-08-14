import { describe, expect, it } from 'vitest'
import { mapFinanceSnapshot } from '@/lib/domain/finance/mappers'

describe('Stage 6.6 finanzas', () => {
  it('normaliza saldos, cuentas, movimientos y conciliación', () => {
    const value = mapFinanceSnapshot({
      period: { from: '2026-08-01', to: '2026-08-14' },
      summary: { receivable_open: '1500.50', payable_open: 800, period_inflow: '2000', period_outflow: '300' },
      accounts: [{
        id: 'a', kind: 'receivable', sale_id: '7', original_amount: '2000', net_amount: '1800',
        paid_amount: '300', balance: '1500', status: 'partial', movements: [{ id: 'm', amount: '300', payment_method: 'efectivo' }],
      }],
      reconciliation: [{ payment_method: 'efectivo', inflow: '2000', outflow: '300', net: '1700' }],
    })
    expect(value.summary.receivable_open).toBe(1500.5)
    expect(value.accounts[0]).toEqual(expect.objectContaining({ sale_id: 7, balance: 1500, status: 'partial' }))
    expect(value.accounts[0].movements[0].amount).toBe(300)
    expect(value.reconciliation[0].net).toBe(1700)
  })

  it('aplica defaults seguros a respuestas incompletas', () => {
    const value = mapFinanceSnapshot(null)
    expect(value.accounts).toEqual([])
    expect(value.reconciliation).toEqual([])
    expect(value.summary.period_inflow).toBe(0)
  })
})
