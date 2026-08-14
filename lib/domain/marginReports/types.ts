export type MarginPeriod = 'month' | '30d' | '90d' | '365d'

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
  net_units: number
  net_revenue: number
  known_cogs: number
  gross_margin: number | null
  margin_percent: number | null
  margin_complete: boolean
  has_estimated_cost: boolean
}

export type MarginReport = {
  from: string
  to: string
  summary: MarginSummary
  daily: MarginDaily[]
  items: MarginItem[]
}
