/**
 * Construcción de payload y mapeo de errores para POS / create_sale_with_items.
 * La DB (RPC) es autoridad de precios y stock; este módulo solo orquesta superficie.
 */
import type { ItemCarrito, PagoDesglose } from '@/lib/domain/types'
import { AppError, mapRpcMessageToAppError } from '@/lib/domain/errors'

export type CreateSaleInput = {
  carrito: ItemCarrito[]
  clienteSeleccionado: number | null
  nombreClienteOtro: string
  clientes: Array<{ id: number; first_name: string; last_name: string }>
  metodoPago: 'efectivo' | 'tarjeta' | 'transferencia'
  paymentBreakdown: PagoDesglose[] | null
  cobrarDespues: boolean
  notas: string
}

export type CreateSaleRpcPayload = {
  sale: Record<string, unknown>
  lines: Array<Record<string, unknown>>
}

export type CreateSaleResultSale = {
  id: number
  total: number
  customer_name: string | null
  payment_method: string | null
  payment_breakdown?: unknown
  notes: string | null
  sale_date: string
  created_at: string
}

export type CreateSaleResultLine = {
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
}

export type CreateSaleResult = {
  sale: CreateSaleResultSale
  lines: CreateSaleResultLine[]
}

/** Valida carrito y arma el payload del RPC (sin unit_price/total autoritativos). */
export function buildCreateSalePayload(input: CreateSaleInput): CreateSaleRpcPayload {
  if (!input.carrito.length) {
    throw new AppError('validation', 'El carrito está vacío.')
  }

  let customerName = ''
  if (input.nombreClienteOtro.trim() !== '') {
    customerName = input.nombreClienteOtro.trim()
  } else if (input.clienteSeleccionado) {
    const cliente = input.clientes.find((c) => c.id === input.clienteSeleccionado)
    if (cliente) customerName = `${cliente.first_name} ${cliente.last_name}`
  }

  const tieneDesglose =
    !input.cobrarDespues && input.paymentBreakdown && input.paymentBreakdown.length > 0

  const sale: Record<string, unknown> = {
    sale_date: new Date().toISOString(),
    payment_method: input.cobrarDespues
      ? 'credito'
      : tieneDesglose
        ? 'mixto'
        : input.metodoPago,
    customer_name: customerName || null,
    customer_id: input.nombreClienteOtro.trim() !== '' ? null : input.clienteSeleccionado,
    notes: input.notas || null,
    status: input.cobrarDespues ? 'pending_payment' : 'completed',
  }
  if (tieneDesglose && input.paymentBreakdown) {
    sale.payment_breakdown = input.paymentBreakdown
  }

  const lines: Array<Record<string, unknown>> = []
  for (const item of input.carrito) {
    if (item.producto) {
      lines.push({
        line_type: 'product',
        product_id: item.producto.id,
        quantity: item.cantidad,
      })
    } else if (item.combo) {
      lines.push({
        line_type: 'combo',
        combo_id: item.combo.id,
        quantity: item.cantidad,
      })
    }
  }

  if (lines.length === 0) {
    throw new AppError('validation', 'El carrito no tiene líneas válidas.')
  }

  return { sale, lines }
}

export function parseCreateSaleRpcResult(rpcData: unknown): CreateSaleResult {
  const payload = rpcData as {
    sale?: Record<string, unknown>
    lines?: Array<Record<string, unknown>>
  } | null
  const venta = payload?.sale as CreateSaleResultSale | undefined
  if (!venta?.id) {
    throw new AppError('unknown', 'La venta no se pudo registrar correctamente.')
  }
  const rawLines = Array.isArray(payload?.lines) ? payload!.lines! : []
  const lines: CreateSaleResultLine[] = rawLines.map((ln) => ({
    product_name: String(ln.product_name ?? ''),
    quantity: Number(ln.quantity),
    unit_price: Number(ln.unit_price),
    subtotal: Number(ln.subtotal),
  }))
  return { sale: venta, lines }
}

export function createSaleErrorFromRpc(message: string): AppError {
  return mapRpcMessageToAppError(message)
}
