import type { AppTab } from '@/lib/appTabs'

export type PanelChannel = 'pos' | 'catalog' | 'combined'

export type PanelQuery = {
  tab: AppTab
  customerId?: number | string
  orderId?: string
  channel?: PanelChannel
}

/** Enlaces internos del panel autenticado. Conserva el SPA `?tab=`. */
export function panelHref(query: PanelQuery): string {
  const params = new URLSearchParams()
  params.set('tab', query.tab)
  if (query.customerId != null && query.customerId !== '') {
    params.set('customerId', String(query.customerId))
  }
  if (query.orderId) params.set('orderId', query.orderId)
  if (query.channel) params.set('channel', query.channel)
  return `/?${params.toString()}`
}
