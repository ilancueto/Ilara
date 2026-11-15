'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Check,
  ChevronRight,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useConfirm } from '@/hooks/useConfirm'
import {
  deleteCancelledOrders,
  getOrderDetail,
  listOrders,
  transitionOrder,
} from '@/lib/domain/orders/browserOrders'
import { notifyOrderStatusAction } from '@/app/actions/orders'
import {
  ORDER_STATUSES,
  orderStatusLabel,
  type OrderStatus,
} from '@/lib/domain/orders/states'
import type { OrderDetail, OrderListItem } from '@/lib/domain/orders/types'
import { formatPesoARExact } from '@/lib/formatPesoAR'
import { isAppError, toUserMessage } from '@/lib/domain/errors'
import { useToast } from '@/context/ToastContext'
import { logStructured, createRequestId } from '@/lib/observability/logger'
import { ObservabilityEvent } from '@/lib/observability/events'
import {
  adminOrderPaymentsAction,
  type AdminOrderPayment,
} from '@/app/actions/adminPayments'
import { PedidoPagosPanel } from '@/components/Pedidos/PedidoPagosPanel'
import { statusBadgeClass, nextActions } from '@/components/Pedidos/pedidoUi'
import {
  PedidoCancelarForm,
  PedidoDatosContacto,
  PedidoDevoluciones,
  PedidoEnvio,
  PedidoHistorial,
  PedidoLineas,
} from '@/components/Pedidos/PedidoDetalleSecciones'
import { panelHref } from '@/lib/appNavigation'

const STATUS_FILTERS: Array<OrderStatus | 'all'> = ['all', ...ORDER_STATUSES]
const ORDER_PAGE_SIZE = 50

export default function Pedidos() {
  const { showToast } = useToast()
  const { confirm, confirmProps } = useConfirm()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<OrderListItem[]>([])
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const listRequest = useRef(0)
  const detailRequest = useRef(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<OrderDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [payments, setPayments] = useState<AdminOrderPayment[]>([])

  const loadList = useCallback(async () => {
    const request = ++listRequest.current
    setLoading(true)
    setListError(null)
    try {
      const rows = await listOrders({
        status: statusFilter,
        query,
        limit: ORDER_PAGE_SIZE + 1,
        offset: page * ORDER_PAGE_SIZE,
      })
      if (request !== listRequest.current) return
      if (!rows.length && page > 0) { setPage(page - 1); return }
      setOrders(rows.slice(0, ORDER_PAGE_SIZE))
      setHasNextPage(rows.length > ORDER_PAGE_SIZE)
    } catch (err) {
      if (request === listRequest.current) setListError(toUserMessage(err, 'No se pudieron cargar los pedidos.'))
    } finally {
      if (request === listRequest.current) setLoading(false)
    }
  }, [statusFilter, query, page])

  useEffect(() => {
    const counter = listRequest
    const timer = setTimeout(() => void loadList(), 250)
    return () => { clearTimeout(timer); ++counter.current }
  }, [loadList])

  useEffect(() => () => { ++detailRequest.current }, [])

  const openDetail = useCallback(
    async (id: string) => {
      const request = ++detailRequest.current
      setSelectedId(id)
      setDetailLoading(true)
      setDetail(null)
      setPayments([])
      try {
        const [d, pay] = await Promise.all([getOrderDetail(id), adminOrderPaymentsAction(id)])
        if (request !== detailRequest.current) return
        setDetail(d)
        if (pay.ok) setPayments(pay.data)
        else showToast('warning', 'No se pudieron actualizar los pagos de este pedido.')
      } catch (err) {
        if (request !== detailRequest.current) return
        showToast('error', toUserMessage(err, 'No se pudo cargar el detalle.'))
        setSelectedId(null)
      } finally {
        if (request === detailRequest.current) setDetailLoading(false)
      }
    },
    [showToast]
  )

  useEffect(() => {
    const fromUrl = searchParams.get('orderId')
    if (fromUrl) void openDetail(fromUrl)
  }, [searchParams, openDetail])

  const applyTransition = useCallback(
    async (to: OrderStatus, reason: string | null) => {
      if (!detail) return
      setActionLoading(true)
      const requestId = createRequestId()
      try {
        const result = await transitionOrder(detail.id, to, reason)
        if (!result.idempotent_replay) {
          const notification = await notifyOrderStatusAction(result.order_number, result.status)
          if (!notification.ok) showToast('warning', 'El estado se guardó, pero no se pudo enviar el aviso por email.')
        }
        logStructured({
          event: ObservabilityEvent.ORDER_STATUS_CHANGED,
          level: 'info',
          requestId,
          route: '/panel/pedidos',
          meta: {
            orderNumber: result.order_number,
            status: result.status,
            from: result.from_status,
            idempotent: result.idempotent_replay,
          },
        })
        showToast('success', `Pedido ${result.order_number}: ${orderStatusLabel(result.status)}`)
        setCancelOpen(false)
        setCancelReason('')
        setCancelError(null)
        const d = await getOrderDetail(detail.id)
        setDetail(d)
        await loadList()
      } catch (err) {
        const code = isAppError(err) ? err.message : 'transition_failed'
        logStructured({
          event:
            to === 'cancelled'
              ? ObservabilityEvent.ORDER_CANCEL_FAILED
              : to === 'confirmed'
                ? ObservabilityEvent.ORDER_CONFIRMATION_FAILED
                : ObservabilityEvent.ORDER_STATUS_CHANGED,
          level: 'warn',
          requestId,
          route: '/panel/pedidos',
          code: String(code).slice(0, 64),
        })
        showToast('error', toUserMessage(err, 'No se pudo actualizar el pedido.'))
      } finally {
        setActionLoading(false)
      }
    },
    [detail, showToast, loadList]
  )

  const runTransition = useCallback(
    async (to: OrderStatus) => {
      if (!detail) return
      if (to === 'cancelled') {
        setCancelOpen(true)
        setCancelReason('')
        setCancelError(null)
        return
      }
      const ok = await confirm({
        title: `¿Pasar a “${orderStatusLabel(to)}”?`,
        description: `Pedido ${detail.order_number}. ${
          to === 'confirmed' ? 'Se reservará stock de forma atómica.' : 'Cambio de estado operativo.'
        }`,
        confirmLabel: orderStatusLabel(to),
        cancelLabel: 'Volver',
        danger: false,
      })
      if (!ok) return
      await applyTransition(to, null)
    },
    [detail, confirm, applyTransition]
  )

  const confirmCancel = useCallback(async () => {
    const reason = cancelReason.trim()
    if (reason.length < 3) {
      setCancelError('Indicá un motivo de al menos 3 caracteres.')
      return
    }
    const ok = await confirm({
      title: detail ? `¿Cancelar pedido ${detail.order_number}?` : '¿Cancelar pedido?',
      description: detail?.stock_reserved
        ? 'Se restaurará el stock reservado. Esta acción queda en el historial.'
        : 'El pedido pasará a cancelado. Esta acción queda en el historial.',
      confirmLabel: 'Cancelar pedido',
      cancelLabel: 'Volver',
      danger: true,
    })
    if (!ok) return
    await applyTransition('cancelled', reason)
  }, [cancelReason, applyTransition, confirm, detail])

  const actions = useMemo(
    () => (detail ? nextActions(detail.status) : []),
    [detail]
  )

  const cancelledCount = useMemo(
    () => orders.filter((order) => order.status === 'cancelled').length,
    [orders]
  )

  const handleDeleteOne = useCallback(async () => {
    if (!detail || detail.status !== 'cancelled') return
    const ok = await confirm({
      title: `¿Borrar ${detail.order_number}?`,
      description: 'Se elimina del listado. No se puede deshacer.',
      confirmLabel: 'Borrar pedido',
      cancelLabel: 'Volver',
      danger: true,
    })
    if (!ok) return
    setActionLoading(true)
    try {
      await deleteCancelledOrders(detail.id)
      showToast('success', `Se borró ${detail.order_number}.`)
      setSelectedId(null)
      setDetail(null)
      await loadList()
    } catch (err) {
      showToast('error', toUserMessage(err, 'No se pudo borrar el pedido.'))
    } finally {
      setActionLoading(false)
    }
  }, [confirm, detail, loadList, showToast])

  const handleDeleteCancelled = useCallback(async () => {
    const ok = await confirm({
      title: '¿Borrar todos los pedidos cancelados?',
      description:
        'Se eliminan los cancelados. Si alguno tuvo un cobro aprobado, ese se deja.',
      confirmLabel: 'Borrar cancelados',
      cancelLabel: 'Volver',
      danger: true,
    })
    if (!ok) return
    setActionLoading(true)
    try {
      const result = await deleteCancelledOrders()
      if (result.deleted_count === 0 && result.skipped_count === 0) {
        showToast('info', 'No hay pedidos cancelados para borrar.')
      } else if (result.skipped_count > 0) {
        showToast(
          'success',
          `Se borraron ${result.deleted_count}. ${result.skipped_count} se dejaron porque tuvieron cobro.`
        )
      } else {
        showToast('success', `Se borraron ${result.deleted_count} pedidos cancelados.`)
      }
      setSelectedId(null)
      setDetail(null)
      await loadList()
    } catch (err) {
      showToast('error', toUserMessage(err, 'No se pudieron borrar los pedidos.'))
    } finally {
      setActionLoading(false)
    }
  }, [confirm, loadList, showToast])

  return (
    <div className="flex flex-col gap-5 animate-fade-in pb-8" data-testid="pedidos-panel">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-ink">
            Pedidos
          </h2>
          <p className="text-sm text-muted mt-1">
            Operación, pago, envío, devolución y contacto de la clienta
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleDeleteCancelled()}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30 disabled:opacity-60"
            data-testid="pedidos-delete-cancelled"
          >
            <Trash2 size={16} />
            {cancelledCount > 0 ? `Borrar cancelados (${cancelledCount})` : 'Borrar cancelados'}
          </button>
          <button
            type="button"
            onClick={() => void loadList()}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-line px-3 py-2 text-sm font-semibold hover:bg-canvas"
            data-testid="pedidos-refresh"
          >
            <RefreshCw size={16} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <label className="relative flex-1">
          <span className="sr-only">Buscar pedidos</span>
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => { ++listRequest.current; setLoading(true); setPage(0); setQuery(e.target.value) }}
            placeholder="Número, nombre o teléfono"
            className="w-full rounded-xl border border-line bg-surface pl-9 pr-3 py-2.5 text-sm"
            data-testid="pedidos-search"
          />
        </label>
        <label className="sm:w-48">
          <span className="sr-only">Filtrar por estado</span>
          <select
            value={statusFilter}
            onChange={(e) => { ++listRequest.current; setLoading(true); setPage(0); setStatusFilter(e.target.value as OrderStatus | 'all') }}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
            data-testid="pedidos-status-filter"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? 'Todos los estados' : orderStatusLabel(s)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-line bg-surface overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-pink-500">
              <Loader2 className="animate-spin" size={20} />
              Cargando…
            </div>
          ) : listError ? (
            <div role="alert" className="p-6 text-center text-rose-700 dark:text-rose-300">
              {listError}
              <button type="button" onClick={() => void loadList()} className="block mx-auto mt-3 underline">Reintentar</button>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 px-6 text-center text-gray-500">
              <Package className="mx-auto mb-2 opacity-50" />
              No hay pedidos con estos filtros.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800" role="list">
              {orders.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => void openDetail(o.id)}
                    disabled={actionLoading}
                    className={[
                      'w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-pink-50/60 dark:hover:bg-pink-950/20 transition-colors',
                      selectedId === o.id ? 'bg-primary-soft' : '',
                    ].join(' ')}
                    data-testid={`pedido-row-${o.order_number}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-ink">
                          {o.order_number}
                        </span>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${statusBadgeClass(o.status)}`}
                        >
                          {orderStatusLabel(o.status)}
                        </span>
                      </div>
                      <p className="text-sm text-muted truncate">
                        {o.customer_name} · {o.customer_phone}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(o.created_at).toLocaleString('es-AR')} · $
                        {formatPesoARExact(o.total)}
                      </p>
                    </div>
                    <ChevronRight size={18} className="text-gray-400 shrink-0" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <nav aria-label="Páginas de pedidos" className="flex items-center justify-between gap-2 border-t p-3 text-sm">
            <button type="button" disabled={page === 0 || loading} className="rounded-lg border px-3 py-2 disabled:opacity-40"
              onClick={() => { ++listRequest.current; setLoading(true); setPage(p => Math.max(0, p - 1)) }}>Anterior</button>
            <span aria-live="polite">Página {page + 1}</span>
            <button type="button" disabled={!hasNextPage || loading || Boolean(listError)} className="rounded-lg border px-3 py-2 disabled:opacity-40"
              onClick={() => { ++listRequest.current; setLoading(true); setPage(p => p + 1) }}>Siguiente</button>
          </nav>
        </div>

        <div className="lg:col-span-3 rounded-2xl border border-line bg-surface p-4 sm:p-5 min-h-[320px]">
          {!selectedId && (
            <p className="text-sm text-gray-500 py-12 text-center">
              Seleccioná un pedido para ver el detalle.
            </p>
          )}
          {selectedId && detailLoading && (
            <div className="flex items-center justify-center gap-2 py-16 text-pink-500">
              <Loader2 className="animate-spin" size={20} />
              Cargando detalle…
            </div>
          )}
          {detail && !detailLoading && (
            <div className="flex flex-col gap-4" data-testid="pedido-detail">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-xl font-extrabold text-ink">
                    {detail.order_number}
                  </h3>
                  <span
                    className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full ${statusBadgeClass(detail.status)}`}
                  >
                    {orderStatusLabel(detail.status)}
                  </span>
                </div>
                <button
                  type="button"
                  className="p-2 rounded-lg hover:bg-surface-soft"
                  onClick={() => {
                    setSelectedId(null)
                    setDetail(null)
                  }}
                  aria-label="Cerrar detalle"
                >
                  <X size={18} />
                </button>
              </div>

              <PedidoDatosContacto detail={detail} />

              {detail.notes && (
                <div className="rounded-xl bg-canvas px-3 py-2 text-sm">
                  <p className="text-xs text-gray-400 mb-0.5">Notas del cliente</p>
                  <p>{detail.notes}</p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-bold mb-2">Pago</h4>
                <PedidoPagosPanel
                  orderId={detail.id}
                  payments={payments}
                  onChange={(next) => {
                    setPayments(next)
                    void getOrderDetail(detail.id).then(setDetail)
                    void loadList()
                  }}
                />
              </div>

              {(detail.shipping_quote_id || detail.fulfillment_mode !== 'envio') && (
                <PedidoEnvio detail={detail} />
              )}

              <div className="flex flex-wrap gap-2">
                <a
                  href={panelHref({ tab: 'returns', channel: 'catalog', orderId: detail.id })}
                  className="rounded-xl border border-line px-3 py-2 text-xs font-bold hover:bg-canvas"
                  data-testid="pedido-open-return"
                >
                  Registrar devolución
                </a>
                <a
                  href={panelHref({ tab: 'margin_reports', channel: 'catalog' })}
                  className="rounded-xl border border-line px-3 py-2 text-xs font-bold hover:bg-canvas"
                >
                  Ver margen del catálogo
                </a>
              </div>

              {detail.returns.length > 0 && (
                <PedidoDevoluciones items={detail.returns} />
              )}

              <PedidoLineas detail={detail} />

              <PedidoHistorial events={detail.events} />

              {cancelOpen && (
                <PedidoCancelarForm
                  reason={cancelReason}
                  onReasonChange={setCancelReason}
                  error={cancelError}
                  loading={actionLoading}
                  onConfirm={() => void confirmCancel()}
                  onBack={() => {
                    setCancelOpen(false)
                    setCancelError(null)
                  }}
                />
              )}

              {detail.status === 'cancelled' && !cancelOpen && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => void handleDeleteOne()}
                  className="inline-flex items-center gap-1.5 self-start rounded-xl border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 disabled:opacity-60"
                  data-testid="pedido-delete"
                >
                  <Trash2 size={16} />
                  Borrar pedido
                </button>
              )}

              {actions.length > 0 && !cancelOpen && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {actions.map((to) => (
                    <button
                      key={to}
                      type="button"
                      disabled={actionLoading}
                      onClick={() => void runTransition(to)}
                      className={[
                        'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-colors',
                        to === 'cancelled'
                          ? 'bg-rose-600 text-white hover:bg-rose-700'
                          : 'bg-pink-600 text-white hover:bg-pink-700',
                        actionLoading ? 'opacity-60 cursor-not-allowed' : '',
                      ].join(' ')}
                      data-testid={`pedido-transition-${to}`}
                    >
                      {to === 'cancelled' ? <X size={16} /> : <Check size={16} />}
                      {orderStatusLabel(to)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog {...confirmProps} testId="confirm-pedido" />
    </div>
  )
}
