/**
 * Máquina de estados de pedidos de catálogo (Stage 6.1).
 * La autoridad real es Postgres (`transition_catalog_order`); este módulo
 * es espejo puro para UI/tests.
 */

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'completed',
  'cancelled',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ['completed', 'cancelled']

/** Transiciones permitidas (from → to[]). Misma regla que el RPC. */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value)
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true // idempotente
  return (ORDER_TRANSITIONS[from] ?? []).includes(to)
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return (TERMINAL_ORDER_STATUSES as readonly string[]).includes(status)
}

/** ¿Esta transición descuenta/reserva stock? Sólo pending → confirmed. */
export function transitionReservesStock(from: OrderStatus, to: OrderStatus): boolean {
  return from === 'pending' && to === 'confirmed'
}

/** ¿Esta transición puede restaurar stock? cancel con reserva, incluso desde pending. */
export function transitionMayRestoreStock(from: OrderStatus, to: OrderStatus): boolean {
  return to === 'cancelled' && from !== 'cancelled'
}

export function orderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case 'pending':
      return 'Pendiente'
    case 'confirmed':
      return 'Confirmado'
    case 'preparing':
      return 'En preparación'
    case 'ready':
      return 'Listo'
    case 'completed':
      return 'Completado'
    case 'cancelled':
      return 'Cancelado'
    default:
      return status
  }
}
