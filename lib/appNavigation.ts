import type { AppTab } from '@/lib/appTabs'

export type PanelChannel = 'pos' | 'catalog' | 'combined'

export type PanelQuery = {
  tab: AppTab
  customerId?: number | string
  orderId?: string
  channel?: PanelChannel
  productId?: number | string
  saleId?: number | string
  view?: string
  focus?: string
}

export type PanelNavigate = (dest: AppTab | PanelQuery) => void

export function toPanelQuery(dest: AppTab | PanelQuery): PanelQuery {
  return typeof dest === 'string' ? { tab: dest } : dest
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
  if (query.productId != null && query.productId !== '') {
    params.set('productId', String(query.productId))
  }
  if (query.saleId != null && query.saleId !== '') {
    params.set('saleId', String(query.saleId))
  }
  if (query.view) params.set('view', query.view)
  if (query.focus) params.set('focus', query.focus)
  return `/?${params.toString()}`
}
