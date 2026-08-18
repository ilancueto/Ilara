import { AppError } from '@/lib/domain/errors'
import type {
  CatalogRefundAction,
  CreateOrderReturnResult,
  CreateSaleReturnResult,
  OrderReturnListItem,
  RefundMethod,
  ReturnableOrder,
  ReturnableSale,
  SaleReturnListItem,
} from './types'
import { REFUND_METHODS } from './rules'

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
const num = (v: unknown): number => Number(v) || 0
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const nullableStr = (v: unknown): string | null => (typeof v === 'string' ? v : null)

export function mapReturnableSales(rows: unknown[], returnedRows: unknown[]): ReturnableSale[] {
  const returned = new Map<number, number>()
  for (const raw of returnedRows) {
    const r = obj(raw)
    const id = num(r.sale_item_id)
    returned.set(id, (returned.get(id) || 0) + num(r.quantity))
  }

  return rows
    .map((raw) => {
      const r = obj(raw)
      const items = (Array.isArray(r.sale_items) ? r.sale_items : []).map((rawItem) => {
        const i = obj(rawItem)
        const quantity = num(i.quantity)
        const returnedQuantity = returned.get(num(i.id)) || 0
        return {
          id: num(i.id),
          product_id: i.product_id == null ? null : num(i.product_id),
          combo_id: i.combo_id == null ? null : num(i.combo_id),
          product_name: str(i.product_name),
          quantity,
          returned_quantity: returnedQuantity,
          available_quantity: Math.max(0, quantity - returnedQuantity),
          unit_price: num(i.unit_price),
          subtotal: num(i.subtotal),
        }
      })
      const available = items.filter((i) => i.available_quantity > 0)
      return {
        id: num(r.id),
        sale_date: str(r.sale_date),
        created_at: str(r.created_at),
        customer_name: nullableStr(r.customer_name),
        total: num(r.total),
        status: str(r.status),
        payment_method: nullableStr(r.payment_method),
        items: available,
        available_total: available.reduce(
          (sum, i) => sum + (i.subtotal * i.available_quantity) / i.quantity,
          0
        ),
      }
    })
    .filter((sale) => sale.items.length > 0)
}

export function mapSaleReturn(row: unknown): SaleReturnListItem {
  const r = obj(row)
  const sale = obj(r.sales)
  const method = str(r.refund_method) as RefundMethod
  return {
    id: str(r.id),
    credit_note_number: num(r.credit_note_number),
    sale_id: num(r.sale_id),
    reason: str(r.reason),
    refund_method: REFUND_METHODS.includes(method) ? method : 'otro',
    refund_total: num(r.refund_total),
    restock: Boolean(r.restock),
    created_at: str(r.created_at),
    customer_name: nullableStr(sale.customer_name),
    items: (Array.isArray(r.sale_return_items) ? r.sale_return_items : []).map((rawItem) => {
      const i = obj(rawItem)
      return {
        id: num(i.id),
        sale_item_id: num(i.sale_item_id),
        product_name: str(i.product_name),
        quantity: num(i.quantity),
        refund_amount: num(i.refund_amount),
      }
    }),
  }
}

export function parseCreateSaleReturnResult(data: unknown): CreateSaleReturnResult {
  const r = obj(data)
  if (!str(r.id) || !num(r.credit_note_number)) {
    throw new AppError('unknown', 'La nota de crédito no devolvió un resultado válido.', {
      message: 'invalid_return_result',
    })
  }
  return {
    id: str(r.id),
    credit_note_number: num(r.credit_note_number),
    sale_id: num(r.sale_id),
    refund_total: num(r.refund_total),
    restock: Boolean(r.restock),
    idempotent_replay: Boolean(r.idempotent_replay),
  }
}

function catalogAction(value: unknown): CatalogRefundAction {
  const action = str(value)
  if (action === 'record_manual' || action === 'request_mp') return action
  return 'none'
}

export function mapReturnableOrders(rows: unknown[], returnedRows: unknown[]): ReturnableOrder[] {
  const returned = new Map<number, number>()
  for (const raw of returnedRows) {
    const r = obj(raw)
    const id = num(r.order_item_id)
    returned.set(id, (returned.get(id) || 0) + num(r.quantity))
  }

  return rows
    .map((raw) => {
      const r = obj(raw)
      const items = (Array.isArray(r.order_items) ? r.order_items : []).map((rawItem) => {
        const i = obj(rawItem)
        const quantity = num(i.quantity)
        const returnedQuantity = returned.get(num(i.id)) || 0
        return {
          id: num(i.id),
          product_id: i.product_id == null ? null : num(i.product_id),
          combo_id: i.combo_id == null ? null : num(i.combo_id),
          product_name: str(i.name_snapshot || i.product_name),
          quantity,
          returned_quantity: returnedQuantity,
          available_quantity: Math.max(0, quantity - returnedQuantity),
          unit_price: num(i.unit_price),
          subtotal: num(i.line_subtotal ?? i.subtotal),
        }
      })
      const available = items.filter((i) => i.available_quantity > 0)
      return {
        id: str(r.id),
        order_number: str(r.order_number),
        created_at: str(r.created_at),
        customer_name: nullableStr(r.customer_name),
        customer_id: r.customer_id == null ? null : num(r.customer_id),
        total: num(r.total),
        status: str(r.status),
        stock_reserved: Boolean(r.stock_reserved),
        items: available,
        available_total: available.reduce(
          (sum, i) => sum + (i.quantity > 0 ? (i.subtotal * i.available_quantity) / i.quantity : 0),
          0
        ),
      }
    })
    .filter((order) => order.items.length > 0)
}

export function mapOrderReturn(row: unknown): OrderReturnListItem {
  const r = obj(row)
  const order = obj(r.orders)
  return {
    id: str(r.id),
    return_number: num(r.return_number),
    order_id: str(r.order_id),
    order_number: nullableStr(order.order_number) || nullableStr(r.order_number),
    reason: str(r.reason),
    refund_action: catalogAction(r.refund_action),
    refund_total: num(r.refund_total),
    restock: Boolean(r.restock),
    created_at: str(r.created_at),
    customer_name: nullableStr(order.customer_name),
    items: (Array.isArray(r.order_return_items) ? r.order_return_items : []).map((rawItem) => {
      const i = obj(rawItem)
      return {
        id: num(i.id),
        order_item_id: num(i.order_item_id),
        product_name: str(i.product_name),
        quantity: num(i.quantity),
        refund_amount: num(i.refund_amount),
      }
    }),
  }
}

export function parseCreateOrderReturnResult(data: unknown): CreateOrderReturnResult {
  const r = obj(data)
  if (!str(r.id) || !num(r.return_number)) {
    throw new AppError('unknown', 'La devolución no devolvió un resultado válido.', {
      message: 'invalid_order_return_result',
    })
  }
  return {
    id: str(r.id),
    return_number: num(r.return_number),
    order_id: str(r.order_id),
    refund_total: num(r.refund_total),
    restock: Boolean(r.restock),
    refund_action: catalogAction(r.refund_action),
    idempotent_replay: Boolean(r.idempotent_replay),
  }
}

export function saleReturnErrorFromRpc(message: string): AppError {
  const m = message || ''
  if (m.includes('return_quantity_exceeds_available')) {
    return new AppError('conflict', 'Una cantidad ya fue devuelta. Actualizá y revisá las líneas.', {
      message: 'return_quantity_exceeds_available',
      retryable: true,
    })
  }
  if (m.includes('order_item_not_found') || m.includes('order_not_found') || m.includes('order_not_returnable')) {
    return new AppError('not_found', 'El pedido o una de sus líneas ya no admite devolución.', {
      message: 'order_not_returnable',
    })
  }
  if (m.includes('stock_not_reserved')) {
    return new AppError('validation', 'Este pedido todavía no reservó stock. No hay unidades para reintegrar.', {
      message: 'stock_not_reserved',
    })
  }
  if (m.includes('sale_item_not_found') || m.includes('sale_not_found')) {
    return new AppError('not_found', 'La venta o una de sus líneas ya no existe.', {
      message: 'sale_not_found',
    })
  }
  if (m.includes('pending_sale_requires_credit_cancellation')) {
    return new AppError('validation', 'Una venta pendiente sólo puede cancelar su saldo a crédito.', {
      message: 'pending_sale_requires_credit_cancellation',
    })
  }
  if (m.includes('completed_sale_requires_refund_method')) {
    return new AppError('validation', 'Elegí cómo se reintegrará el dinero.', {
      message: 'completed_sale_requires_refund_method',
    })
  }
  if (m.includes('missing_component_snapshot')) {
    return new AppError('conflict', 'No hay información suficiente para reintegrar ese stock.', {
      message: 'missing_component_snapshot',
    })
  }
  if (m.includes('forbidden') || m.includes('42501')) {
    return new AppError('forbidden', 'Sólo un administrador puede registrar devoluciones.', {
      message: 'forbidden',
    })
  }
  if (m.includes('invalid_') || m.includes('return_lines_required')) {
    return new AppError('validation', 'Revisá el motivo, método y cantidades de la devolución.', {
      message: 'invalid_return',
    })
  }
  return new AppError('unknown', 'No se pudo registrar la devolución. Intentá de nuevo.', {
    message: m.split(/[:\s]/)[0]?.slice(0, 64) || 'return_rpc_error',
    retryable: true,
  })
}
