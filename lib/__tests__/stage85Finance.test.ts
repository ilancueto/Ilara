import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mapCatalogFinanceSlice, mapPaymentOpsBoard } from '../domain/payments/finance'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260818014000_stage85_payment_finance.sql'),
  'utf8'
)

describe('Stage 8.5 — slice financiero', () => {
  it('separa mostrador, pedidos y neto combinado', () => {
    const slice = mapCatalogFinanceSlice({
      period: { from: '2026-08-01', to: '2026-08-17' },
      pos: { inflow: 1000, outflow: 200, net: 800 },
      catalog: {
        inflow: 105700,
        outflow: 0,
        net: 105700,
        methods: [{ method: 'mercado_pago', inflow: 105700, outflow: 0, net: 105700 }],
      },
      combined: { inflow: 106700, outflow: 200, net: 106500 },
      margin: {
        gross: 105700,
        estimated_fee: 5613,
        actual_fee: 5614,
        fee_delta: 1,
        net_received: 100086,
        refunds: 0,
      },
      findings: [],
    })
    expect(slice.pos.net).toBe(800)
    expect(slice.catalog.inflow).toBe(105700)
    expect(slice.combined.net).toBe(106500)
    expect(slice.margin.fee_delta).toBe(1)
    expect(slice.methods[0].method).toBe('mercado_pago')
  })

  it('el tablero operativo nace con flags apagados si no hay datos', () => {
    const board = mapPaymentOpsBoard(null)
    expect(board.flags.payments_enabled).toBe(false)
    expect(board.recent).toEqual([])
    expect(board.findings).toEqual([])
  })
})

describe('Stage 8.5 — migración', () => {
  it('no escribe sales ni incomes y calcula hallazgos', () => {
    expect(migration).toContain('finance_stage8_payments_slice')
    expect(migration).toContain('admin_payment_ops_board')
    expect(migration).toContain("origin', 'catalog_payment")
    expect(migration).toContain('confirmed_without_payment')
    expect(migration).toContain('approved_on_cancelled_order')
    expect(migration).not.toMatch(/INSERT INTO public\.sales/i)
    expect(migration).not.toMatch(/INSERT INTO public\.incomes/i)
  })

  it('lista cobros de catálogo para el panel', () => {
    const list = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260818254000_stage85_list_catalog_collections.sql'),
      'utf8'
    )
    expect(list).toContain('admin_list_catalog_collections')
    expect(list).toContain('America/Argentina/Buenos_Aires')
  })
})
