import { describe, expect, it } from 'vitest'
import { mapMarginReport, marginReportError } from '@/lib/domain/marginReports/mappers'
import { formatMarginMoney, marginPeriodRange } from '@/lib/domain/marginReports/rules'

describe('Stage 6.4 reportes de margen', () => {
  it('calcula períodos inclusivos sin depender de UTC', () => {
    const now = new Date(2026, 7, 13, 23, 30)
    expect(marginPeriodRange('month', now)).toEqual({ from: '2026-08-01', to: '2026-08-13' })
    expect(marginPeriodRange('30d', now)).toEqual({ from: '2026-07-15', to: '2026-08-13' })
    expect(marginPeriodRange('90d', now)).toEqual({ from: '2026-05-16', to: '2026-08-13' })
    expect(marginPeriodRange('365d', now)).toEqual({ from: '2025-08-14', to: '2026-08-13' })
  })

  it('preserva margen nulo cuando faltan costos', () => {
    const report = mapMarginReport({
      from: '2026-08-01', to: '2026-08-13',
      summary: { net_revenue: '1000', known_cogs: '0', gross_margin: null, margin_percent: null, margin_complete: false, missing_cost_lines: 1 },
      daily: [{ date: '2026-08-13', net_revenue: '1000', known_cogs: 0, gross_margin: null, margin_complete: false }],
      items: [{ name: 'Sin costo', product_id: 1, net_units: 1, net_revenue: '1000', known_cogs: 0, gross_margin: null, margin_percent: null, margin_complete: false }],
    })
    expect(report.summary.gross_margin).toBeNull()
    expect(report.items[0].margin_percent).toBeNull()
    expect(formatMarginMoney(report.summary.gross_margin)).toBe('Sin datos')
  })

  it('normaliza números serializados por Postgres', () => {
    const report = mapMarginReport({
      from: '2026-08-01', to: '2026-08-13',
      summary: { sale_count: '2', net_revenue: '2500.50', known_cogs: '1000', gross_margin: '1500.50', margin_percent: '60.01', margin_complete: true },
      daily: [], items: [],
    })
    expect(report.summary.sale_count).toBe(2)
    expect(report.summary.net_revenue).toBe(2500.5)
    expect(report.summary.margin_percent).toBe(60.01)
  })

  it('mapea denegación e intervalo inválido a errores seguros', () => {
    expect(marginReportError('forbidden').code).toBe('forbidden')
    expect(marginReportError('invalid_margin_report_range').code).toBe('validation')
  })
})
