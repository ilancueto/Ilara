import { describe, it, expect } from 'vitest'
import {
  compareAlertUrgency,
  isLowStock,
  stockDeficit,
  suggestedReplenishQty,
  targetStock,
} from '../domain/stockAlerts/rules'
import {
  canTransitionStockAlert,
  isActiveStockAlertStatus,
  isTerminalStockAlertStatus,
  STOCK_ALERT_TRANSITIONS,
  stockAlertStatusLabel,
} from '../domain/stockAlerts/states'
import {
  mapStockAlertListItem,
  parseTransitionStockAlertResult,
  stockAlertErrorFromRpc,
} from '../domain/stockAlerts/mappers'

describe('Stage 6.2 — regla de activación', () => {
  it('alerta cuando stock <= min_stock (incluye igualdad)', () => {
    expect(isLowStock(5, 5)).toBe(true)
    expect(isLowStock(4, 5)).toBe(true)
    expect(isLowStock(6, 5)).toBe(false)
    expect(isLowStock(0, 0)).toBe(true)
  })
})

describe('Stage 6.2 — cantidad sugerida y déficit', () => {
  it('target = max(min*2, min+1); min 0 → 1', () => {
    expect(targetStock(0)).toBe(1)
    expect(targetStock(5)).toBe(10)
    expect(targetStock(1)).toBe(2)
  })

  it('suggested siempre >= 1 en alerta', () => {
    expect(suggestedReplenishQty(5, 5)).toBe(5) // target 10
    expect(suggestedReplenishQty(0, 0)).toBe(1)
    expect(suggestedReplenishQty(3, 10)).toBe(17) // target 20
    expect(suggestedReplenishQty(9, 5)).toBe(1) // no alerta, pero fórmula >= 1
  })

  it('déficit no negativo', () => {
    expect(stockDeficit(3, 10)).toBe(7)
    expect(stockDeficit(10, 5)).toBe(0)
    expect(stockDeficit(5, 5)).toBe(0)
  })
})

describe('Stage 6.2 — urgencia', () => {
  it('ordena por déficit, luego stock, luego antigüedad', () => {
    const rows = [
      { deficit: 1, stock_current: 4, opened_at: '2026-01-02T00:00:00Z' },
      { deficit: 5, stock_current: 0, opened_at: '2026-01-03T00:00:00Z' },
      { deficit: 5, stock_current: 1, opened_at: '2026-01-01T00:00:00Z' },
    ]
    const sorted = [...rows].sort(compareAlertUrgency)
    expect(sorted[0].deficit).toBe(5)
    expect(sorted[0].stock_current).toBe(0)
    expect(sorted[2].deficit).toBe(1)
  })
})

describe('Stage 6.2 — estados', () => {
  it('transiciones permitidas e idempotencia', () => {
    expect(canTransitionStockAlert('open', 'in_progress')).toBe(true)
    expect(canTransitionStockAlert('open', 'resolved')).toBe(true)
    expect(canTransitionStockAlert('open', 'dismissed')).toBe(true)
    expect(canTransitionStockAlert('in_progress', 'resolved')).toBe(true)
    expect(canTransitionStockAlert('resolved', 'open')).toBe(false)
    expect(canTransitionStockAlert('dismissed', 'open')).toBe(false)
    expect(canTransitionStockAlert('resolved', 'resolved')).toBe(true)
    expect(STOCK_ALERT_TRANSITIONS.resolved).toEqual([])
    expect(isTerminalStockAlertStatus('dismissed')).toBe(true)
    expect(isActiveStockAlertStatus('open')).toBe(true)
    expect(stockAlertStatusLabel('in_progress')).toBe('En curso')
  })
})

describe('Stage 6.2 — mappers y errores', () => {
  it('mapStockAlertListItem con producto', () => {
    const row = mapStockAlertListItem({
      id: 'a1',
      product_id: 9,
      status: 'open',
      stock_at_open: 1,
      min_stock_at_open: 5,
      stock_current: 1,
      min_stock_current: 5,
      suggested_qty: 9,
      deficit: 4,
      resolution_kind: null,
      assigned_to: null,
      opened_at: '2026-01-01',
      updated_at: '2026-01-01',
      resolved_at: null,
      dismissed_at: null,
      note: null,
      products: { name: 'Labial', brand: 'X', categories: { name: 'Maquillaje' } },
    })
    expect(row.product_name).toBe('Labial')
    expect(row.category_name).toBe('Maquillaje')
    expect(row.suggested_qty).toBe(9)
  })

  it('parse transición y errores RPC', () => {
    const r = parseTransitionStockAlertResult({
      alert_id: 'a',
      product_id: 1,
      status: 'in_progress',
      from_status: 'open',
      resolution_kind: null,
      idempotent_replay: false,
    })
    expect(r.status).toBe('in_progress')
    expect(stockAlertErrorFromRpc('dismiss_note_required').code).toBe('validation')
    expect(stockAlertErrorFromRpc('not_authorized').code).toBe('forbidden')
  })
})
