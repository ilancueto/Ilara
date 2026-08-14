'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, CheckCircle2, ChevronRight, History, Loader2, PackageCheck, RefreshCw, Search } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useConfirm } from '@/hooks/useConfirm'
import { useToast } from '@/context/ToastContext'
import { toUserMessage } from '@/lib/domain/errors'
import {
  createSaleReturn,
  listReturnableSales,
  listSaleReturns,
} from '@/lib/domain/returns/browserReturns'
import {
  creditNoteLabel,
  previewRefundAmount,
  refundMethodLabel,
  REFUND_METHODS,
} from '@/lib/domain/returns/rules'
import type {
  RefundMethod,
  ReturnableSale,
  SaleReturnListItem,
} from '@/lib/domain/returns/types'
import { createRequestId, logStructured } from '@/lib/observability/logger'
import { ObservabilityEvent } from '@/lib/observability/events'

const money = (value: number) =>
  value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
const dateTime = (value: string) => new Date(value).toLocaleString('es-AR')

function defaultRefundMethod(sale: ReturnableSale): RefundMethod {
  if (sale.status === 'pending_payment') return 'credito_cancelado'
  if (sale.payment_method === 'efectivo') return 'efectivo'
  if (sale.payment_method === 'transferencia') return 'transferencia'
  if (sale.payment_method === 'tarjeta') return 'tarjeta'
  return 'otro'
}

export default function Devoluciones() {
  const { showSuccess, showError } = useToast()
  const { confirm, confirmProps } = useConfirm()
  const [sales, setSales] = useState<ReturnableSale[]>([])
  const [returns, setReturns] = useState<SaleReturnListItem[]>([])
  const [selected, setSelected] = useState<ReturnableSale | null>(null)
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [reason, setReason] = useState('')
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('efectivo')
  const [restock, setRestock] = useState(true)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'create' | 'history'>('create')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [nextSales, nextReturns] = await Promise.all([
        listReturnableSales(),
        listSaleReturns(),
      ])
      setSales(nextSales)
      setReturns(nextReturns)
    } catch (error) {
      showError(toUserMessage(error, 'No se pudo cargar el módulo de devoluciones.'))
    } finally {
      setLoading(false)
    }
  }, [showError])

  useEffect(() => { void load() }, [load])

  const filteredSales = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sales
    return sales.filter((sale) =>
      `${sale.id} ${sale.customer_name || ''} ${sale.items.map((i) => i.product_name).join(' ')}`
        .toLowerCase().includes(q)
    )
  }, [sales, query])

  const selectedLines = useMemo(
    () => selected?.items
      .map((item) => ({ item, quantity: quantities[item.id] || 0 }))
      .filter((line) => line.quantity > 0) || [],
    [selected, quantities]
  )
  const previewTotal = useMemo(
    () => selectedLines.reduce(
      (sum, line) => sum + previewRefundAmount(line.item, line.quantity), 0
    ),
    [selectedLines]
  )

  const selectSale = (sale: ReturnableSale) => {
    setSelected(sale)
    setQuantities({})
    setReason('')
    setRefundMethod(defaultRefundMethod(sale))
    setRestock(true)
  }

  const submit = async () => {
    if (!selected || selectedLines.length === 0) {
      showError('Elegí al menos una unidad para devolver.')
      return
    }
    if (reason.trim().length < 3) {
      showError('Escribí un motivo de al menos 3 caracteres.')
      return
    }
    const ok = await confirm({
      title: '¿Emitir nota de crédito?',
      description: `Se registrará una devolución por ${money(previewTotal)}. La venta original no se modificará.`,
      confirmLabel: 'Emitir nota',
      cancelLabel: 'Volver',
      danger: false,
    })
    if (!ok) return

    setSubmitting(true)
    const requestId = createRequestId()
    try {
      const result = await createSaleReturn({
        saleId: selected.id, reason, refundMethod, restock,
        idempotencyKey: crypto.randomUUID(),
        lines: selectedLines.map(({ item, quantity }) => ({
          saleItemId: item.id, quantity,
        })),
      })
      logStructured({
        event: ObservabilityEvent.SALE_RETURN_CREATED,
        level: 'info',
        requestId,
        route: '/panel/devoluciones',
        meta: {
          saleId: result.sale_id,
          creditNoteNumber: result.credit_note_number,
          lineCount: selectedLines.length,
          restock: result.restock,
          idempotent: result.idempotent_replay,
        },
      })
      showSuccess(`${creditNoteLabel(result.credit_note_number)} emitida por ${money(result.refund_total)}.`)
      setSelected(null)
      setQuantities({})
      setReason('')
      await load()
      setView('history')
    } catch (error) {
      logStructured({
        event: ObservabilityEvent.SALE_RETURN_FAILED,
        level: 'warn', requestId, route: '/panel/devoluciones',
        code: error instanceof Error ? error.message.slice(0, 64) : 'return_failed',
      })
      showError(toUserMessage(error, 'No se pudo registrar la devolución.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 animate-fade-in pb-8" data-testid="devoluciones-panel">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-50">
            Devoluciones y notas de crédito
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Reversión trazable · la venta original permanece intacta
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
          data-testid="returns-refresh">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      <div className="inline-flex self-start rounded-xl border border-gray-200 dark:border-gray-700 p-1 bg-white dark:bg-gray-900">
        <button type="button" onClick={() => setView('create')}
          className={`px-3 py-2 rounded-lg text-sm font-bold ${view === 'create' ? 'bg-pink-500 text-white' : 'text-gray-600 dark:text-gray-300'}`}
          data-testid="returns-tab-create">Nueva devolución</button>
        <button type="button" onClick={() => setView('history')}
          className={`px-3 py-2 rounded-lg text-sm font-bold ${view === 'history' ? 'bg-pink-500 text-white' : 'text-gray-600 dark:text-gray-300'}`}
          data-testid="returns-tab-history">Historial ({returns.length})</button>
      </div>

      {loading ? (
        <div className="py-20 flex items-center justify-center gap-2 text-pink-500">
          <Loader2 className="animate-spin" /> Cargando…
        </div>
      ) : view === 'history' ? (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
          {returns.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <History className="mx-auto mb-2 opacity-50" /> Todavía no hay notas de crédito.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {returns.map((item) => (
                <li key={item.id} className="p-4 sm:p-5" data-testid={`return-row-${item.credit_note_number}`}>
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <p className="font-extrabold text-gray-900 dark:text-gray-50">
                        {creditNoteLabel(item.credit_note_number)} · Venta #{item.sale_id}
                      </p>
                      <p className="text-sm text-gray-500">
                        {item.customer_name || 'Consumidor final'} · {dateTime(item.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-rose-600 dark:text-rose-400">-{money(item.refund_total)}</p>
                      <p className="text-xs text-gray-500">
                        {refundMethodLabel(item.refund_method)} · {item.restock ? 'stock reintegrado' : 'sin reintegro'}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">{item.reason}</p>
                  <ul className="mt-2 text-xs text-gray-500 space-y-1">
                    {item.items.map((line) => (
                      <li key={line.id}>{line.product_name} ×{line.quantity} · {money(line.refund_amount)}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
            <label className="relative block m-3">
              <span className="sr-only">Buscar venta</span>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Venta, cliente o producto"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent pl-9 pr-3 py-2.5 text-sm"
                data-testid="returns-search" />
            </label>
            {filteredSales.length === 0 ? (
              <div className="py-14 px-5 text-center text-gray-500">
                <CheckCircle2 className="mx-auto mb-2 opacity-50" /> No hay ventas con unidades disponibles.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredSales.map((sale) => (
                  <li key={sale.id}>
                    <button type="button" onClick={() => selectSale(sale)}
                      className={`w-full text-left p-4 flex items-center gap-3 hover:bg-pink-50/60 dark:hover:bg-pink-950/20 ${selected?.id === sale.id ? 'bg-pink-50 dark:bg-pink-950/30' : ''}`}
                      data-testid={`return-sale-${sale.id}`}>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900 dark:text-gray-50">
                          Venta #{sale.id} · {sale.customer_name || 'Consumidor final'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {dateTime(sale.created_at)} · {sale.items.length} línea(s) disponibles
                        </p>
                      </div>
                      <ChevronRight size={18} className="text-gray-400" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="lg:col-span-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 sm:p-5">
            {!selected ? (
              <div className="py-16 text-center text-gray-500">
                <ArrowLeftRight className="mx-auto mb-2 opacity-50" /> Seleccioná una venta.
              </div>
            ) : (
              <div className="space-y-5" data-testid="return-form">
                <div>
                  <h3 className="text-lg font-extrabold">Venta #{selected.id}</h3>
                  <p className="text-sm text-gray-500">
                    {selected.customer_name || 'Consumidor final'} · total original {money(selected.total)}
                  </p>
                </div>
                <fieldset className="space-y-3">
                  <legend className="text-sm font-bold mb-2">Unidades a devolver</legend>
                  {selected.items.map((item) => (
                    <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 items-center rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{item.product_name}</p>
                        <p className="text-xs text-gray-500">
                          Disponible {item.available_quantity}/{item.quantity} · {money(item.subtotal)} original
                        </p>
                      </div>
                      <label>
                        <span className="sr-only">Cantidad de {item.product_name}</span>
                        <input type="number" min={0} max={item.available_quantity} step={1}
                          value={quantities[item.id] || 0}
                          onChange={(e) => {
                            const next = Math.max(0, Math.min(
                              item.available_quantity, Math.floor(Number(e.target.value) || 0)
                            ))
                            setQuantities((current) => ({ ...current, [item.id]: next }))
                          }}
                          className="w-20 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-2 text-center tabular-nums"
                          data-testid={`return-qty-${item.id}`} />
                      </label>
                    </div>
                  ))}
                </fieldset>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-sm font-bold">Forma de reintegro
                    <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value as RefundMethod)}
                      disabled={selected.status === 'pending_payment'}
                      className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2.5 font-normal"
                      data-testid="return-refund-method">
                      {REFUND_METHODS.filter((method) => selected.status === 'pending_payment'
                        ? method === 'credito_cancelado' : method !== 'credito_cancelado')
                        .map((method) => <option key={method} value={method}>{refundMethodLabel(method)}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 sm:mt-6">
                    <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)}
                      data-testid="return-restock" />
                    <span className="text-sm font-semibold">Reintegrar al stock</span>
                  </label>
                </div>
                <label className="block text-sm font-bold">Motivo *
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3}
                    placeholder="Ej.: producto sin uso, cambio solicitado por clienta"
                    className="mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2.5 font-normal"
                    data-testid="return-reason" />
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-gray-100 dark:border-gray-800 pt-4">
                  <div>
                    <p className="text-xs text-gray-500">Crédito estimado</p>
                    <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{money(previewTotal)}</p>
                    <p className="text-[11px] text-gray-400">La base recalcula el monto exacto.</p>
                  </div>
                  <button type="button" onClick={() => void submit()}
                    disabled={submitting || selectedLines.length === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white px-5 py-3 font-bold disabled:opacity-50"
                    data-testid="return-submit">
                    {submitting ? <Loader2 size={17} className="animate-spin" /> : <PackageCheck size={17} />}
                    Emitir nota de crédito
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <ConfirmDialog {...confirmProps} testId="confirm-sale-return" />
    </div>
  )
}
