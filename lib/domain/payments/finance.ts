export type PaymentFinding = {
  code: string
  severity: 'info' | 'warning' | 'critical'
  order_number: string | null
  detail: string
}

export type CatalogFinanceSlice = {
  period: { from: string; to: string }
  pos: { inflow: number; outflow: number; net: number }
  catalog: { inflow: number; outflow: number; net: number }
  combined: { inflow: number; outflow: number; net: number }
  margin: {
    gross: number
    estimated_fee: number
    actual_fee: number
    fee_delta: number
    net_received: number
    refunds: number
  }
  methods: Array<{ method: string; inflow: number; outflow: number; net: number }>
  findings: PaymentFinding[]
}

export type PaymentOpsBoard = {
  flags: {
    payments_enabled: boolean
    mercado_pago_enabled: boolean
    bank_transfer_enabled: boolean
    catalog_dual_price_visible: boolean
  }
  expire: { has_run: boolean; last_finished_at: string | null; last_expired_count: number | null }
  findings: PaymentFinding[]
  recent: Array<{
    id: string
    order_number: string
    method: string
    status: string
    amount_due: number
    estimated_fee: number | null
    actual_fee: number | null
    approved_at: string | null
    created_at: string
  }>
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
const num = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0)

function mapFinding(raw: unknown): PaymentFinding {
  const row = record(raw)
  const severity = row.severity === 'critical' || row.severity === 'info' ? row.severity : 'warning'
  return {
    code: String(row.code || ''),
    severity,
    order_number: row.order_number == null ? null : String(row.order_number),
    detail: String(row.detail || ''),
  }
}

export function mapCatalogFinanceSlice(raw: unknown): CatalogFinanceSlice {
  const source = record(raw)
  const period = record(source.period)
  const pos = record(source.pos)
  const catalog = record(source.catalog)
  const combined = record(source.combined)
  const margin = record(source.margin)
  return {
    period: { from: String(period.from || ''), to: String(period.to || '') },
    pos: { inflow: num(pos.inflow), outflow: num(pos.outflow), net: num(pos.net) },
    catalog: { inflow: num(catalog.inflow), outflow: num(catalog.outflow), net: num(catalog.net) },
    combined: { inflow: num(combined.inflow), outflow: num(combined.outflow), net: num(combined.net) },
    margin: {
      gross: num(margin.gross),
      estimated_fee: num(margin.estimated_fee),
      actual_fee: num(margin.actual_fee),
      fee_delta: num(margin.fee_delta),
      net_received: num(margin.net_received),
      refunds: num(margin.refunds),
    },
    methods: Array.isArray(catalog.methods)
      ? catalog.methods.map((item) => {
        const row = record(item)
        return {
          method: String(row.method || ''),
          inflow: num(row.inflow),
          outflow: num(row.outflow),
          net: num(row.net),
        }
      })
      : [],
    findings: Array.isArray(source.findings) ? source.findings.map(mapFinding) : [],
  }
}

export function mapPaymentOpsBoard(raw: unknown): PaymentOpsBoard {
  const source = record(raw)
  const flags = record(source.flags)
  const expire = record(source.expire)
  return {
    flags: {
      payments_enabled: flags.payments_enabled === true,
      mercado_pago_enabled: flags.mercado_pago_enabled === true,
      bank_transfer_enabled: flags.bank_transfer_enabled === true,
      catalog_dual_price_visible: flags.catalog_dual_price_visible === true,
    },
    expire: {
      has_run: expire.has_run === true,
      last_finished_at: expire.last_finished_at == null ? null : String(expire.last_finished_at),
      last_expired_count: expire.last_expired_count == null ? null : num(expire.last_expired_count),
    },
    findings: Array.isArray(source.findings) ? source.findings.map(mapFinding) : [],
    recent: Array.isArray(source.recent)
      ? source.recent.map((item) => {
        const row = record(item)
        return {
          id: String(row.id || ''),
          order_number: String(row.order_number || ''),
          method: String(row.method || ''),
          status: String(row.status || ''),
          amount_due: num(row.amount_due),
          estimated_fee: row.estimated_fee == null ? null : num(row.estimated_fee),
          actual_fee: row.actual_fee == null ? null : num(row.actual_fee),
          approved_at: row.approved_at == null ? null : String(row.approved_at),
          created_at: String(row.created_at || ''),
        }
      })
      : [],
  }
}
