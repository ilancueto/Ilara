'use client'

/**
 * Panel admin: listado y transiciones de alertas (browser + RLS/RPC).
 */
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { AppError } from '@/lib/domain/errors'
import {
  mapStockAlertDetail,
  mapStockAlertListItem,
  parseTransitionStockAlertResult,
  stockAlertErrorFromRpc,
} from '@/lib/domain/stockAlerts/mappers'
import { compareAlertUrgency } from '@/lib/domain/stockAlerts/rules'
import type { StockAlertStatus } from '@/lib/domain/stockAlerts/states'
import type {
  StockAlertDetail,
  StockAlertListItem,
  TransitionStockAlertResult,
} from '@/lib/domain/stockAlerts/types'

const ALERT_SELECT = `
  id, product_id, status,
  stock_at_open, min_stock_at_open, stock_current, min_stock_current,
  suggested_qty, deficit, resolution_kind, assigned_to,
  opened_at, updated_at, resolved_at, dismissed_at, note,
  products(name, brand, categories(name))
`

const EVENT_SELECT =
  'id, alert_id, from_status, to_status, actor_user_id, actor_kind, reason, meta, created_at'

export type ListStockAlertsFilter = {
  status?: StockAlertStatus | 'active' | 'all'
  query?: string
  limit?: number
}

export async function countOpenStockAlerts(): Promise<number> {
  const supabase = getBrowserSupabase()
  const { count, error } = await supabase
    .from('stock_alerts')
    .select('id', { count: 'exact', head: true })
    .in('status', ['open', 'in_progress'])
  if (error) {
    throw new AppError('unknown', 'No se pudo contar alertas.', {
      message: error.message?.slice(0, 64) || 'count_alerts_failed',
      retryable: true,
    })
  }
  return count ?? 0
}

export async function listStockAlerts(
  filter: ListStockAlertsFilter = {}
): Promise<StockAlertListItem[]> {
  const supabase = getBrowserSupabase()
  let q = supabase.from('stock_alerts').select(ALERT_SELECT).limit(filter.limit ?? 200)

  if (filter.status === 'active' || !filter.status) {
    q = q.in('status', ['open', 'in_progress'])
  } else if (filter.status !== 'all') {
    q = q.eq('status', filter.status)
  }

  const { data, error } = await q
  if (error) {
    throw new AppError('unknown', 'No se pudieron cargar las alertas.', {
      message: error.message?.slice(0, 64) || 'list_alerts_failed',
      retryable: true,
    })
  }

  let rows = (data || []).map(mapStockAlertListItem)

  const query = (filter.query || '').trim().toLowerCase()
  if (query) {
    rows = rows.filter((r) => {
      const hay = `${r.product_name || ''} ${r.product_brand || ''} ${r.category_name || ''} ${r.product_id}`
        .toLowerCase()
      return hay.includes(query)
    })
  }

  // Urgencia en cliente (misma regla documentada)
  rows.sort(compareAlertUrgency)
  return rows
}

export async function getStockAlertDetail(alertId: string): Promise<StockAlertDetail> {
  const supabase = getBrowserSupabase()
  const { data: alert, error } = await supabase
    .from('stock_alerts')
    .select(ALERT_SELECT)
    .eq('id', alertId)
    .maybeSingle()

  if (error) {
    throw new AppError('unknown', 'No se pudo cargar la alerta.', {
      message: error.message?.slice(0, 64) || 'get_alert_failed',
      retryable: true,
    })
  }
  if (!alert) {
    throw new AppError('not_found', 'Alerta no encontrada.', { message: 'alert_not_found' })
  }

  const { data: events, error: eventsErr } = await supabase
    .from('stock_alert_events')
    .select(EVENT_SELECT)
    .eq('alert_id', alertId)
    .order('created_at', { ascending: true })

  if (eventsErr) {
    throw new AppError('unknown', 'No se pudo cargar el historial.', {
      message: 'alert_events_failed',
      retryable: true,
    })
  }

  return mapStockAlertDetail(alert, events || [])
}

export async function transitionStockAlert(
  alertId: string,
  toStatus: StockAlertStatus,
  note?: string | null
): Promise<TransitionStockAlertResult> {
  const supabase = getBrowserSupabase()
  const { data, error } = await supabase.rpc('transition_stock_alert', {
    p_alert_id: alertId,
    p_to_status: toStatus,
    p_note: note ?? null,
  })
  if (error) {
    throw stockAlertErrorFromRpc(error.message || '')
  }
  return parseTransitionStockAlertResult(data)
}
