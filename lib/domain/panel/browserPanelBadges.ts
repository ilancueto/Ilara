'use client'

import { getBrowserSupabase } from '@/lib/supabase/browser'
import { AppError } from '@/lib/domain/errors'

export type PanelBadges = {
  ordersPendingOrConfirmed: number
  ordersInOps: number
  productsOutOfStock: number
}

const EMPTY: PanelBadges = {
  ordersPendingOrConfirmed: 0,
  ordersInOps: 0,
  productsOutOfStock: 0,
}

export async function fetchPanelBadges(): Promise<PanelBadges> {
  const supabase = getBrowserSupabase()
  const [pending, ops, stock] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'confirmed']),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'confirmed', 'preparing']),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('stock', 0),
  ])

  if (pending.error || ops.error || stock.error) {
    throw new AppError('unknown', 'No se pudieron cargar los avisos del panel.', {
      message: (pending.error || ops.error || stock.error)?.message?.slice(0, 64) || 'panel_badges',
      retryable: true,
    })
  }

  return {
    ordersPendingOrConfirmed: pending.count ?? 0,
    ordersInOps: ops.count ?? 0,
    productsOutOfStock: stock.count ?? 0,
  }
}

export function emptyPanelBadges(): PanelBadges {
  return EMPTY
}
