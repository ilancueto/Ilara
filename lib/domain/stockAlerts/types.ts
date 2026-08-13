import type {
  StockAlertResolutionKind,
  StockAlertStatus,
} from '@/lib/domain/stockAlerts/states'

export type StockAlertListItem = {
  id: string
  product_id: number
  status: StockAlertStatus
  stock_at_open: number
  min_stock_at_open: number
  stock_current: number
  min_stock_current: number
  suggested_qty: number
  deficit: number
  resolution_kind: StockAlertResolutionKind | null
  assigned_to: string | null
  opened_at: string
  updated_at: string
  resolved_at: string | null
  dismissed_at: string | null
  note: string | null
  /** Join opcional de producto (admin). */
  product_name?: string | null
  product_brand?: string | null
  category_name?: string | null
}

export type StockAlertEvent = {
  id: number
  alert_id: string
  from_status: StockAlertStatus | null
  to_status: StockAlertStatus
  actor_user_id: string | null
  actor_kind: 'system' | 'admin'
  reason: string | null
  meta: Record<string, unknown>
  created_at: string
}

export type StockAlertDetail = StockAlertListItem & {
  events: StockAlertEvent[]
}

export type TransitionStockAlertResult = {
  alert_id: string
  product_id: number
  status: StockAlertStatus
  from_status?: StockAlertStatus
  resolution_kind: StockAlertResolutionKind | null
  idempotent_replay: boolean
}
