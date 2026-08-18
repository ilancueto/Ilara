export type MarginPeriod = 'month' | '30d' | '90d' | '365d'
export type MarginChannel = 'pos' | 'catalog' | 'combined'

export type MarginSummary = {
  sale_count: number
  units_sold: number
  units_returned: number
  list_revenue: number
  gross_revenue: number
  discount_total: number
  refund_total: number
  net_revenue: number
  known_cogs: number
  gross_margin: number | null
  margin_percent: number | null
  margin_complete: boolean
  cost_coverage_percent: number
  exact_lines: number
  estimated_lines: number
  missing_cost_lines: number
}

export type MarginDaily = {
  date: string
  net_revenue: number
  known_cogs: number
  gross_margin: number | null
  margin_complete: boolean
}

export type MarginItem = {
  name: string
  product_id: number | null
  combo_id: number | null
  channel?: MarginChannel | 'catalog' | 'pos'
  net_units: number
  net_revenue: number
  known_cogs: number
  gross_margin: number | null
  margin_percent: number | null
  margin_complete: boolean
  has_estimated_cost: boolean
}

export type CatalogMarginSummary = MarginSummary & {
  order_count?: number
  subtotal?: number
  shipping_charged?: number
  estimated_fee?: number
  actual_fee?: number
  payment_refund?: number
  missing_cost_orders?: number
}

export type PendingCostOrder = {
  id: string
  order_number: string
  created_at: string | null
}

export type MarginReport = {
  from: string
  to: string
  channel?: MarginChannel
  summary: MarginSummary
  pos?: CatalogMarginSummary
  catalog?: CatalogMarginSummary
  combined?: CatalogMarginSummary
  pending_cost_orders?: PendingCostOrder[]
  daily: MarginDaily[]
  items: MarginItem[]
}
