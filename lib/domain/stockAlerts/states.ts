/**
 * Máquina de estados de alertas de stock (Stage 6.2).
 * Autoridad: Postgres (`transition_stock_alert` + trigger de sync).
 */

export const STOCK_ALERT_STATUSES = [
  'open',
  'in_progress',
  'resolved',
  'dismissed',
] as const

export type StockAlertStatus = (typeof STOCK_ALERT_STATUSES)[number]

export const ACTIVE_STOCK_ALERT_STATUSES: readonly StockAlertStatus[] = [
  'open',
  'in_progress',
]

export const TERMINAL_STOCK_ALERT_STATUSES: readonly StockAlertStatus[] = [
  'resolved',
  'dismissed',
]

export type StockAlertResolutionKind = 'manual' | 'auto_stock'

export const STOCK_ALERT_TRANSITIONS: Record<
  StockAlertStatus,
  readonly StockAlertStatus[]
> = {
  open: ['in_progress', 'resolved', 'dismissed'],
  in_progress: ['resolved', 'dismissed'],
  resolved: [],
  dismissed: [],
}

export function isStockAlertStatus(value: unknown): value is StockAlertStatus {
  return (
    typeof value === 'string' &&
    (STOCK_ALERT_STATUSES as readonly string[]).includes(value)
  )
}

export function canTransitionStockAlert(
  from: StockAlertStatus,
  to: StockAlertStatus
): boolean {
  if (from === to) return true
  return (STOCK_ALERT_TRANSITIONS[from] ?? []).includes(to)
}

export function isActiveStockAlertStatus(status: StockAlertStatus): boolean {
  return (ACTIVE_STOCK_ALERT_STATUSES as readonly string[]).includes(status)
}

export function isTerminalStockAlertStatus(status: StockAlertStatus): boolean {
  return (TERMINAL_STOCK_ALERT_STATUSES as readonly string[]).includes(status)
}

export function stockAlertStatusLabel(status: StockAlertStatus): string {
  switch (status) {
    case 'open':
      return 'Abierta'
    case 'in_progress':
      return 'En curso'
    case 'resolved':
      return 'Resuelta'
    case 'dismissed':
      return 'Descartada'
    default:
      return status
  }
}

export function resolutionKindLabel(
  kind: StockAlertResolutionKind | null | undefined
): string {
  if (kind === 'auto_stock') return 'Recuperación automática de stock'
  if (kind === 'manual') return 'Resolución manual'
  return '—'
}
