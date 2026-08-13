/**
 * Operaciones de pedidos en el panel (browser + RLS/RPC).
 * La autorización real es Supabase.
 */
'use client'

import { getBrowserSupabase } from '@/lib/supabase/browser'
import {
  mapOrderDetail,
  mapOrderListItem,
  parseTransitionOrderResult,
  transitionOrderErrorFromRpc,
} from '@/lib/domain/orders/mappers'
import type { OrderDetail, OrderListItem, TransitionOrderResult } from '@/lib/domain/orders/types'
import type { OrderStatus } from '@/lib/domain/orders/states'
import { AppError } from '@/lib/domain/errors'
import { sanitizeOrderSearchQuery } from '@/lib/domain/orders/validation'

const ORDER_SELECT =
  'id, order_number, status, channel, customer_name, customer_phone, customer_email, notes, subtotal, discount_total, total, coupon_code, coupon_discount_percentage, stock_reserved, created_at, updated_at, confirmed_at, completed_at, cancelled_at, cancel_reason'

const ITEM_SELECT =
  'id, order_id, line_type, product_id, combo_id, name_snapshot, variant_snapshot, combo_components_snapshot, quantity, unit_price, discount_percentage, line_subtotal, sort_order'

const EVENT_SELECT =
  'id, order_id, from_status, to_status, actor_user_id, actor_kind, reason, created_at'

export type ListOrdersFilter = {
  status?: OrderStatus | 'all'
  query?: string
  limit?: number
}

export async function listOrders(filter: ListOrdersFilter = {}): Promise<OrderListItem[]> {
  const supabase = getBrowserSupabase()
  let q = supabase
    .from('orders')
    .select(ORDER_SELECT)
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? 100)

  if (filter.status && filter.status !== 'all') {
    q = q.eq('status', filter.status)
  }

  const query = sanitizeOrderSearchQuery(filter.query || '')
  if (query) {
    // Búsqueda simple: número, nombre o teléfono (ILIKE).
    q = q.or(
      `order_number.ilike.%${query}%,customer_name.ilike.%${query}%,customer_phone.ilike.%${query}%`
    )
  }

  const { data, error } = await q
  if (error) {
    throw new AppError('unknown', 'No se pudieron cargar los pedidos.', {
      message: error.message?.slice(0, 64) || 'list_orders_failed',
      retryable: true,
    })
  }
  return (data || []).map(mapOrderListItem)
}

export async function getOrderDetail(orderId: string): Promise<OrderDetail> {
  const supabase = getBrowserSupabase()
  const { data: order, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('id', orderId)
    .maybeSingle()

  if (error) {
    throw new AppError('unknown', 'No se pudo cargar el pedido.', {
      message: error.message?.slice(0, 64) || 'get_order_failed',
      retryable: true,
    })
  }
  if (!order) {
    throw new AppError('not_found', 'Pedido no encontrado.', { message: 'order_not_found' })
  }

  const [{ data: items, error: itemsErr }, { data: events, error: eventsErr }] =
    await Promise.all([
      supabase
        .from('order_items')
        .select(ITEM_SELECT)
        .eq('order_id', orderId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('order_status_events')
        .select(EVENT_SELECT)
        .eq('order_id', orderId)
        .order('created_at', { ascending: true }),
    ])

  if (itemsErr || eventsErr) {
    throw new AppError('unknown', 'No se pudo cargar el detalle del pedido.', {
      message: 'order_detail_failed',
      retryable: true,
    })
  }

  return mapOrderDetail(order, items || [], events || [])
}

export async function transitionOrder(
  orderId: string,
  toStatus: OrderStatus,
  reason?: string | null
): Promise<TransitionOrderResult> {
  const supabase = getBrowserSupabase()
  const { data, error } = await supabase.rpc('transition_catalog_order', {
    p_order_id: orderId,
    p_to_status: toStatus,
    p_reason: reason ?? null,
  })
  if (error) {
    throw transitionOrderErrorFromRpc(error.message || '')
  }
  return parseTransitionOrderResult(data)
}
