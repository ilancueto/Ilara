import { AppError } from '@/lib/domain/errors'
import type { MarginDaily, MarginItem, MarginReport, MarginSummary } from './types'

const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
const num = (value: unknown): number => Number(value) || 0
const nullableNum = (value: unknown): number | null =>
  value == null || value === '' ? null : Number(value)
const str = (value: unknown): string => (typeof value === 'string' ? value : '')

function mapSummary(value: unknown): MarginSummary {
  const row = obj(value)
  return {
    sale_count: num(row.sale_count),
    units_sold: num(row.units_sold),
    units_returned: num(row.units_returned),
    list_revenue: num(row.list_revenue),
    gross_revenue: num(row.gross_revenue),
    discount_total: num(row.discount_total),
    refund_total: num(row.refund_total),
    net_revenue: num(row.net_revenue),
    known_cogs: num(row.known_cogs),
    gross_margin: nullableNum(row.gross_margin),
    margin_percent: nullableNum(row.margin_percent),
    margin_complete: Boolean(row.margin_complete),
    cost_coverage_percent: num(row.cost_coverage_percent),
    exact_lines: num(row.exact_lines),
    estimated_lines: num(row.estimated_lines),
    missing_cost_lines: num(row.missing_cost_lines),
  }
}

const mapDaily = (value: unknown): MarginDaily => {
  const row = obj(value)
  return {
    date: str(row.date),
    net_revenue: num(row.net_revenue),
    known_cogs: num(row.known_cogs),
    gross_margin: nullableNum(row.gross_margin),
    margin_complete: Boolean(row.margin_complete),
  }
}

const mapItem = (value: unknown): MarginItem => {
  const row = obj(value)
  return {
    name: str(row.name),
    product_id: row.product_id == null ? null : num(row.product_id),
    combo_id: row.combo_id == null ? null : num(row.combo_id),
    net_units: num(row.net_units),
    net_revenue: num(row.net_revenue),
    known_cogs: num(row.known_cogs),
    gross_margin: nullableNum(row.gross_margin),
    margin_percent: nullableNum(row.margin_percent),
    margin_complete: Boolean(row.margin_complete),
    has_estimated_cost: Boolean(row.has_estimated_cost),
  }
}

export function mapMarginReport(value: unknown): MarginReport {
  const row = obj(value)
  const from = str(row.from)
  const to = str(row.to)
  if (!from || !to) {
    throw new AppError('unknown', 'El reporte no devolvió un período válido.', {
      message: 'invalid_margin_report',
    })
  }
  return {
    from,
    to,
    summary: mapSummary(row.summary),
    daily: (Array.isArray(row.daily) ? row.daily : []).map(mapDaily),
    items: (Array.isArray(row.items) ? row.items : []).map(mapItem),
  }
}

export function marginReportError(message: string): AppError {
  if (message.includes('forbidden') || message.includes('42501')) {
    return new AppError('forbidden', 'Sólo un administrador puede consultar márgenes.', {
      message: 'forbidden',
    })
  }
  if (message.includes('invalid_margin_report_range')) {
    return new AppError('validation', 'El período del reporte no es válido.', {
      message: 'invalid_margin_report_range',
    })
  }
  return new AppError('unknown', 'No se pudo cargar el reporte de margen.', {
    message: 'margin_report_failed',
    retryable: true,
  })
}
