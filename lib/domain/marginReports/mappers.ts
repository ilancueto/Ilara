import { AppError } from '@/lib/domain/errors'
import type {
  CatalogMarginSummary,
  MarginChannel,
  MarginDaily,
  MarginItem,
  MarginReport,
} from './types'

const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
const num = (value: unknown): number => Number(value) || 0
const nullableNum = (value: unknown): number | null =>
  value == null || value === '' ? null : Number(value)
const str = (value: unknown): string => (typeof value === 'string' ? value : '')

function mapSummary(value: unknown): CatalogMarginSummary {
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
    order_count: row.order_count == null ? undefined : num(row.order_count),
    subtotal: row.subtotal == null ? undefined : num(row.subtotal),
    shipping_charged: row.shipping_charged == null ? undefined : num(row.shipping_charged),
    estimated_fee: row.estimated_fee == null ? undefined : num(row.estimated_fee),
    actual_fee: row.actual_fee == null ? undefined : num(row.actual_fee),
    payment_refund: row.payment_refund == null ? undefined : num(row.payment_refund),
    missing_cost_orders: row.missing_cost_orders == null ? undefined : num(row.missing_cost_orders),
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
    channel: row.channel === 'pos' || row.channel === 'catalog' ? row.channel : undefined,
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
  const channelRaw = str(row.channel)
  const channel: MarginChannel | undefined =
    channelRaw === 'pos' || channelRaw === 'catalog' || channelRaw === 'combined'
      ? channelRaw
      : undefined
  return {
    from,
    to,
    channel,
    summary: mapSummary(row.summary),
    pos: row.pos == null ? undefined : mapSummary(row.pos),
    catalog: row.catalog == null ? undefined : mapSummary(row.catalog),
    combined: row.combined == null ? undefined : mapSummary(row.combined),
    pending_cost_orders: (Array.isArray(row.pending_cost_orders) ? row.pending_cost_orders : []).map(
      (raw) => {
        const item = obj(raw)
        return {
          id: str(item.id),
          order_number: str(item.order_number),
          created_at: item.created_at == null ? null : str(item.created_at),
        }
      }
    ),
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
  if (message.includes('invalid_margin_report_range') || message.includes('invalid_margin_channel')) {
    return new AppError('validation', 'El período o el origen del reporte no es válido.', {
      message: 'invalid_margin_report_range',
    })
  }
  return new AppError('unknown', 'No se pudo cargar el reporte de margen.', {
    message: 'margin_report_failed',
    retryable: true,
  })
}
