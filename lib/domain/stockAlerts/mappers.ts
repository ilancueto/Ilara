import { AppError } from '@/lib/domain/errors'
import {
  isStockAlertStatus,
  type StockAlertResolutionKind,
  type StockAlertStatus,
} from '@/lib/domain/stockAlerts/states'
import type {
  StockAlertDetail,
  StockAlertEvent,
  StockAlertListItem,
  TransitionStockAlertResult,
} from '@/lib/domain/stockAlerts/types'

function num(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null
  return typeof v === 'string' ? v : null
}

function parseStatus(v: unknown): StockAlertStatus {
  const s = String(v || '')
  if (!isStockAlertStatus(s)) {
    throw new AppError('unknown', 'Estado de alerta inválido.', {
      message: 'invalid_alert_status',
    })
  }
  return s
}

function parseResolution(v: unknown): StockAlertResolutionKind | null {
  if (v == null || v === '') return null
  const s = String(v)
  if (s === 'manual' || s === 'auto_stock') return s
  return null
}

export function mapStockAlertListItem(row: unknown): StockAlertListItem {
  const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>
  const products = r.products as Record<string, unknown> | null | undefined
  const categories = products?.categories as Record<string, unknown> | null | undefined

  return {
    id: str(r.id),
    product_id: num(r.product_id),
    status: parseStatus(r.status),
    stock_at_open: num(r.stock_at_open),
    min_stock_at_open: num(r.min_stock_at_open),
    stock_current: num(r.stock_current),
    min_stock_current: num(r.min_stock_current),
    suggested_qty: num(r.suggested_qty, 1),
    deficit: num(r.deficit),
    resolution_kind: parseResolution(r.resolution_kind),
    assigned_to: strOrNull(r.assigned_to),
    opened_at: str(r.opened_at),
    updated_at: str(r.updated_at),
    resolved_at: strOrNull(r.resolved_at),
    dismissed_at: strOrNull(r.dismissed_at),
    note: strOrNull(r.note),
    product_name: products ? strOrNull(products.name) : null,
    product_brand: products ? strOrNull(products.brand) : null,
    category_name: categories ? strOrNull(categories.name) : null,
  }
}

export function mapStockAlertEvent(row: unknown): StockAlertEvent {
  const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>
  const actor = str(r.actor_kind, 'system')
  const meta =
    r.meta && typeof r.meta === 'object' && !Array.isArray(r.meta)
      ? (r.meta as Record<string, unknown>)
      : {}
  return {
    id: num(r.id),
    alert_id: str(r.alert_id),
    from_status: r.from_status == null ? null : parseStatus(r.from_status),
    to_status: parseStatus(r.to_status),
    actor_user_id: strOrNull(r.actor_user_id),
    actor_kind: actor === 'admin' ? 'admin' : 'system',
    reason: strOrNull(r.reason),
    meta,
    created_at: str(r.created_at),
  }
}

export function mapStockAlertDetail(
  alert: unknown,
  events: unknown[]
): StockAlertDetail {
  return {
    ...mapStockAlertListItem(alert),
    events: events.map(mapStockAlertEvent).sort((a, b) => a.id - b.id),
  }
}

export function parseTransitionStockAlertResult(
  rpcData: unknown
): TransitionStockAlertResult {
  const r = (rpcData && typeof rpcData === 'object' ? rpcData : {}) as Record<
    string,
    unknown
  >
  return {
    alert_id: str(r.alert_id),
    product_id: num(r.product_id),
    status: parseStatus(r.status),
    from_status: r.from_status != null ? parseStatus(r.from_status) : undefined,
    resolution_kind: parseResolution(r.resolution_kind),
    idempotent_replay: Boolean(r.idempotent_replay),
  }
}

export function stockAlertErrorFromRpc(message: string): AppError {
  const m = message || ''
  if (m.includes('invalid_transition')) {
    return new AppError('conflict', 'Esa transición no está permitida.', {
      message: 'invalid_transition',
    })
  }
  if (m.includes('dismiss_note_required')) {
    return new AppError('validation', 'Indicá un motivo de descarte (mín. 3 caracteres).', {
      message: 'dismiss_note_required',
    })
  }
  if (m.includes('resolve_note_required')) {
    return new AppError('validation', 'Indicá una nota de resolución (mín. 3 caracteres).', {
      message: 'resolve_note_required',
    })
  }
  if (m.includes('alert_not_found')) {
    return new AppError('not_found', 'Alerta no encontrada.', { message: 'alert_not_found' })
  }
  if (m.includes('not_authenticated')) {
    return new AppError('auth', 'Sesión expirada. Volvé a iniciar sesión.', {
      message: 'not_authenticated',
    })
  }
  if (m.includes('not_authorized')) {
    return new AppError('forbidden', 'No tenés permiso para gestionar alertas.', {
      message: 'not_authorized',
    })
  }
  return new AppError('unknown', 'No se pudo actualizar la alerta. Intentá de nuevo.', {
    message: m.split(/[:\s]/)[0]?.slice(0, 64) || 'rpc_error',
    retryable: true,
  })
}
