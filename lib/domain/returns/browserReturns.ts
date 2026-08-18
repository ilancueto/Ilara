'use client'

import { getBrowserSupabase } from '@/lib/supabase/browser'
import { AppError } from '@/lib/domain/errors'
import {
  mapOrderReturn,
  mapReturnableOrders,
  mapReturnableSales,
  mapSaleReturn,
  parseCreateOrderReturnResult,
  parseCreateSaleReturnResult,
  saleReturnErrorFromRpc,
} from './mappers'
import type {
  CreateOrderReturnInput,
  CreateOrderReturnResult,
  CreateSaleReturnInput,
  CreateSaleReturnResult,
  OrderReturnListItem,
  ReturnableOrder,
  ReturnableSale,
  SaleReturnListItem,
} from './types'

export async function listReturnableSales(): Promise<ReturnableSale[]> {
  const supabase = getBrowserSupabase()
  const [{ data: sales, error: salesError }, { data: returned, error: returnedError }] =
    await Promise.all([
      supabase
        .from('sales')
        .select(
          'id, sale_date, created_at, customer_name, total, status, payment_method, sale_items(id, product_id, combo_id, product_name, quantity, unit_price, subtotal)'
        )
        .in('status', ['completed', 'pending_payment'])
        .order('created_at', { ascending: false })
        .limit(150),
      supabase.from('sale_return_items').select('sale_item_id, quantity'),
    ])
  if (salesError || returnedError) {
    throw new AppError('unknown', 'No se pudieron cargar las ventas disponibles.', {
      message: 'list_returnable_sales_failed',
      retryable: true,
    })
  }
  return mapReturnableSales(sales || [], returned || [])
}

export async function listSaleReturns(): Promise<SaleReturnListItem[]> {
  const { data, error } = await getBrowserSupabase()
    .from('sale_returns')
    .select(
      'id, credit_note_number, sale_id, reason, refund_method, refund_total, restock, created_at, sales(customer_name), sale_return_items(id, sale_item_id, product_name, quantity, refund_amount)'
    )
    .order('created_at', { ascending: false })
    .limit(150)
  if (error) {
    throw new AppError('unknown', 'No se pudieron cargar las notas de crédito.', {
      message: 'list_sale_returns_failed',
      retryable: true,
    })
  }
  return (data || []).map(mapSaleReturn)
}

export async function createSaleReturn(
  input: CreateSaleReturnInput
): Promise<CreateSaleReturnResult> {
  const { data, error } = await getBrowserSupabase().rpc('create_sale_return', {
    p_payload: {
      sale_id: input.saleId,
      reason: input.reason.trim(),
      refund_method: input.refundMethod,
      restock: input.restock,
      idempotency_key: input.idempotencyKey,
      lines: input.lines.map((line) => ({
        sale_item_id: line.saleItemId,
        quantity: line.quantity,
      })),
    },
  })
  if (error) throw saleReturnErrorFromRpc(error.message || '')
  return parseCreateSaleReturnResult(data)
}

export async function listReturnableOrders(): Promise<ReturnableOrder[]> {
  const supabase = getBrowserSupabase()
  const [{ data: orders, error: ordersError }, { data: returned, error: returnedError }] =
    await Promise.all([
      supabase
        .from('orders')
        .select(
          'id, order_number, created_at, customer_name, customer_id, total, status, stock_reserved, order_items(id, product_id, combo_id, name_snapshot, quantity, unit_price, line_subtotal)'
        )
        .in('status', ['confirmed', 'preparing', 'ready', 'completed'])
        .order('created_at', { ascending: false })
        .limit(150),
      supabase.from('order_return_items').select('order_item_id, quantity'),
    ])
  if (ordersError || returnedError) {
    throw new AppError('unknown', 'No se pudieron cargar los pedidos disponibles.', {
      message: 'list_returnable_orders_failed',
      retryable: true,
    })
  }
  return mapReturnableOrders(orders || [], returned || [])
}

export async function listOrderReturns(): Promise<OrderReturnListItem[]> {
  const { data, error } = await getBrowserSupabase()
    .from('order_returns')
    .select(
      'id, return_number, order_id, reason, refund_action, refund_total, restock, created_at, orders(order_number, customer_name), order_return_items(id, order_item_id, product_name, quantity, refund_amount)'
    )
    .order('created_at', { ascending: false })
    .limit(150)
  if (error) {
    throw new AppError('unknown', 'No se pudieron cargar las devoluciones de pedidos.', {
      message: 'list_order_returns_failed',
      retryable: true,
    })
  }
  return (data || []).map(mapOrderReturn)
}

export async function createOrderReturn(
  input: CreateOrderReturnInput
): Promise<CreateOrderReturnResult> {
  const { data, error } = await getBrowserSupabase().rpc('create_order_return', {
    p_payload: {
      order_id: input.orderId,
      reason: input.reason.trim(),
      refund_action: input.refundAction,
      restock: input.restock,
      order_payment_id: input.orderPaymentId ?? null,
      apply_payment_refund: false,
      idempotency_key: input.idempotencyKey,
      lines: input.lines.map((line) => ({
        order_item_id: line.orderItemId,
        quantity: line.quantity,
      })),
    },
  })
  if (error) throw saleReturnErrorFromRpc(error.message || '')
  return parseCreateOrderReturnResult(data)
}
