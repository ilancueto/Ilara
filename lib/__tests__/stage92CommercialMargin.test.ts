import { describe, expect, it } from 'vitest'
import { mapMarginReport } from '@/lib/domain/marginReports/mappers'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sql92 = readFileSync(
  join(__dirname, '../../supabase/migrations/20260818024000_stage92_commercial_margin.sql'),
  'utf8'
)
const sql64 = readFileSync(
  join(__dirname, '../../supabase/migrations/20260814020513_stage64_margin_reports.sql'),
  'utf8'
)

describe('Stage 9.2 margen consolidado', () => {
  it('no reescribe sales_margin_report y snapshotéa costo al insertar', () => {
    expect(sql92).toContain('order_item_components')
    expect(sql92).toContain("cost_source IN ('order_time', 'legacy_current', 'missing')")
    expect(sql92).toContain('commercial_margin_report')
    expect(sql92).toContain('public.sales_margin_report(')
    expect(sql92).not.toContain('CREATE OR REPLACE FUNCTION public.sales_margin_report')
    expect(sql64).toContain('CREATE OR REPLACE FUNCTION public.sales_margin_report')
  })

  it('históricos quedan como costo no disponible', () => {
    expect(sql92).toMatch(/'missing'/)
    expect(sql92).toContain('legacy_product')
    expect(sql92).not.toMatch(/purchase_price[\s\S]{0,80}legacy_product/)
  })

  it('preserva margen nulo cuando el catálogo no tiene costo', () => {
    const report = mapMarginReport({
      from: '2026-08-01',
      to: '2026-08-17',
      channel: 'catalog',
      summary: {
        net_revenue: '2000',
        known_cogs: '0',
        gross_margin: null,
        margin_complete: false,
        missing_cost_lines: 1,
        missing_cost_orders: 1,
      },
      catalog: { net_revenue: '2000', margin_complete: false, gross_margin: null },
      pos: { net_revenue: '1000', margin_complete: true, gross_margin: '400' },
      combined: { net_revenue: '3000', margin_complete: false, gross_margin: null },
      pending_cost_orders: [{ id: 'o1', order_number: 'IL-000010' }],
      daily: [],
      items: [],
    })
    expect(report.summary.gross_margin).toBeNull()
    expect(report.catalog?.margin_complete).toBe(false)
    expect(report.pos?.gross_margin).toBe(400)
    expect(report.pending_cost_orders?.[0].order_number).toBe('IL-000010')
  })
})
