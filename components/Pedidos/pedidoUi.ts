import type { OrderDetail } from '@/lib/domain/orders/types'
import { ORDER_STATUSES, canTransitionOrder, type OrderStatus } from '@/lib/domain/orders/states'

export function statusBadgeClass(status: OrderStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
    case 'confirmed':
      return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200'
    case 'preparing':
      return 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200'
    case 'ready':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200'
    case 'completed':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
    case 'cancelled':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
  }
}

export function nextActions(status: OrderStatus): OrderStatus[] {
  return ORDER_STATUSES.filter((s) => s !== status && canTransitionOrder(status, s))
}

export function actorLabel(kind: OrderDetail['events'][number]['actor_kind']): string {
  if (kind === 'admin') return 'Equipo'
  if (kind === 'public') return 'Clienta'
  return 'Automático'
}
