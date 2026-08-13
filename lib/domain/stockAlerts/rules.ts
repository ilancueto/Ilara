/**
 * Reglas puras de alertas de reposición (Stage 6.2).
 * Espejo de funciones SQL: stock_alert_target_qty / suggested_qty / deficit.
 */

/** Un producto entra en alerta cuando stock <= min_stock. */
export function isLowStock(stock: number, minStock: number): boolean {
  const s = Number.isFinite(stock) ? Math.floor(stock) : 0
  const m = Number.isFinite(minStock) ? Math.floor(minStock) : 0
  return s <= m
}

/**
 * Stock objetivo de reposición:
 * - min_stock <= 0 → 1
 * - si no → max(min_stock * 2, min_stock + 1)
 *
 * Nunca se presenta como predicción: es reponer hasta un objetivo simple.
 */
export function targetStock(minStock: number): number {
  const m = Number.isFinite(minStock) ? Math.floor(minStock) : 0
  if (m <= 0) return 1
  return Math.max(m * 2, m + 1)
}

/**
 * Cantidad de compra sugerida para una alerta activa.
 * Siempre >= 1 cuando se invoca para un producto en alerta.
 */
export function suggestedReplenishQty(stock: number, minStock: number): number {
  const s = Number.isFinite(stock) ? Math.floor(stock) : 0
  const target = targetStock(minStock)
  return Math.max(1, target - s)
}

/** Déficit respecto al mínimo (0 si stock >= min). */
export function stockDeficit(stock: number, minStock: number): number {
  const s = Number.isFinite(stock) ? Math.floor(stock) : 0
  const m = Number.isFinite(minStock) ? Math.floor(minStock) : 0
  return Math.max(0, m - s)
}

/**
 * Comparador de urgencia (mayor prioridad primero):
 * 1) mayor déficit
 * 2) menor stock actual
 * 3) alerta más antigua
 */
export function compareAlertUrgency(
  a: { deficit: number; stock_current: number; opened_at: string },
  b: { deficit: number; stock_current: number; opened_at: string }
): number {
  if (b.deficit !== a.deficit) return b.deficit - a.deficit
  if (a.stock_current !== b.stock_current) return a.stock_current - b.stock_current
  return String(a.opened_at).localeCompare(String(b.opened_at))
}
