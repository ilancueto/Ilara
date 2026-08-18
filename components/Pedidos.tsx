'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Check,
  ChevronRight,
  Loader2,
  MessageCircle,
  Package,
  RefreshCw,
  Search,
  UserPlus,
  X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useConfirm } from '@/hooks/useConfirm'
import {
  getOrderDetail,
  listOrders,
  transitionOrder,
} from '@/lib/domain/orders/browserOrders'
import {
  ORDER_STATUSES,
  canTransitionOrder,
  orderStatusLabel,
  type OrderStatus,
} from '@/lib/domain/orders/states'
import type { OrderDetail, OrderListItem } from '@/lib/domain/orders/types'
import { formatPesoAR, formatPesoARExact } from '@/lib/formatPesoAR'
import { isAppError, toUserMessage } from '@/lib/domain/errors'
import { useToast } from '@/context/ToastContext'
import { logStructured, createRequestId } from '@/lib/observability/logger'
import { ObservabilityEvent } from '@/lib/observability/events'
import {
  adminOrderPaymentsAction,
  type AdminOrderPayment,
} from '@/app/actions/adminPayments'
import { PedidoPagosPanel } from '@/components/Pedidos/PedidoPagosPanel'
import { panelHref } from '@/lib/appNavigation'
import { catalogReturnLabel, catalogRefundActionLabel } from '@/lib/domain/returns/rules'
import { findOrCreateCustomerFromContact } from '@/lib/domain/customers/browserCustomers'
import { orderWhatsAppMessage, whatsappContactDigits } from '@/lib/domain/orders/orderWhatsApp'
import { buildWhatsAppUrlTo } from '@/lib/whatsappLink'

const STATUS_FILTERS: Array<OrderStatus | 'all'> = ['all', ...ORDER_STATUSES]

function statusBadgeClass(status: OrderStatus): string {
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

function nextActions(status: OrderStatus): OrderStatus[] {
  return ORDER_STATUSES.filter((s) => s !== status && canTransitionOrder(status, s))
}

function actorLabel(kind: OrderDetail['events'][number]['actor_kind']): string {
  if (kind === 'admin') return 'Equipo'
  if (kind === 'public') return 'Clienta'
  return 'Automático'
}

export default function Pedidos() {
  const { showToast } = useToast()
  const { confirm, confirmProps } = useConfirm()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [registeringCustomer, setRegisteringCustomer] = useState(false)
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<OrderListItem[]>([])
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<OrderDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [payments, setPayments] = useState<AdminOrderPayment[]>([])

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await listOrders({
        status: statusFilter,
        query,
        limit: 100,
      })
      setOrders(rows)
    } catch (err) {
      showToast('error', toUserMessage(err, 'No se pudieron cargar los pedidos.'))
    } finally {
      setLoading(false)
    }
  }, [statusFilter, query, showToast])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const openDetail = useCallback(
    async (id: string) => {
      setSelectedId(id)
      setDetailLoading(true)
      setDetail(null)
      setPayments([])
      try {
        const d = await getOrderDetail(id)
        setDetail(d)
        const pay = await adminOrderPaymentsAction(id)
        if (pay.ok) setPayments(pay.data)
      } catch (err) {
        showToast('error', toUserMessage(err, 'No se pudo cargar el detalle.'))
        setSelectedId(null)
      } finally {
        setDetailLoading(false)
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

  return (
    <div className="flex flex-col gap-5 animate-fade-in pb-8" data-testid="pedidos-panel">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-50">
            Pedidos
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Operación, pago, envío, devolución y contacto de la clienta
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadList()}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800"
          data-testid="pedidos-refresh"
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Número, nombre o teléfono"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-9 pr-3 py-2.5 text-sm"
            data-testid="pedidos-search"
          />
        </label>
        <label className="sm:w-48">
          <span className="sr-only">Filtrar por estado</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'all')}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm"
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
        <div className="lg:col-span-2 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-pink-500">
              <Loader2 className="animate-spin" size={20} />
              Cargando…
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
                    className={[
                      'w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-pink-50/60 dark:hover:bg-pink-950/20 transition-colors',
                      selectedId === o.id ? 'bg-pink-50 dark:bg-pink-950/30' : '',
                    ].join(' ')}
                    data-testid={`pedido-row-${o.order_number}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 dark:text-gray-50">
                          {o.order_number}
                        </span>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${statusBadgeClass(o.status)}`}
                        >
                          {orderStatusLabel(o.status)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
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
        </div>

        <div className="lg:col-span-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 sm:p-5 min-h-[320px]">
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
                  <h3 className="text-xl font-extrabold text-gray-900 dark:text-gray-50">
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
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => {
                    setSelectedId(null)
                    setDetail(null)
                  }}
                  aria-label="Cerrar detalle"
                >
                  <X size={18} />
                </button>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-gray-400 text-xs">Clienta</dt>
                  <dd className="font-semibold">
                    {detail.customer_id ? (
                      <a
                        href={panelHref({ tab: 'customers', customerId: detail.customer_id })}
                        className="text-pink-600 dark:text-pink-400 underline-offset-2 hover:underline"
                        data-testid="pedido-open-customer"
                      >
                        {detail.customer_name}
                      </a>
                    ) : (
                      <span className="inline-flex flex-wrap items-center gap-2">
                        {detail.customer_name}
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg border border-pink-200 px-2 py-1 text-xs font-bold text-pink-700 hover:bg-pink-50 dark:border-pink-800 dark:text-pink-300"
                          disabled={registeringCustomer}
                          data-testid="pedido-register-customer"
                          onClick={() => {
                            void (async () => {
                              setRegisteringCustomer(true)
                              try {
                                const created = await findOrCreateCustomerFromContact({
                                  name: detail.customer_name,
                                  phone: detail.customer_phone,
                                  email: detail.customer_email,
                                })
                                router.push(panelHref({ tab: 'customers', customerId: created.id }), { scroll: false })
                              } catch (err) {
                                showToast('error', toUserMessage(err, 'No se pudo registrar a la clienta.'))
                              } finally {
                                setRegisteringCustomer(false)
                              }
                            })()
                          }}
                        >
                          <UserPlus size={14} aria-hidden />
                          Registrar como clienta
                        </button>
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-400 text-xs">Teléfono</dt>
                  <dd className="font-semibold flex flex-wrap items-center gap-2">
                    <span>{detail.customer_phone}</span>
                    {(() => {
                      const url = buildWhatsAppUrlTo(
                        whatsappContactDigits(detail.customer_phone),
                        orderWhatsAppMessage({
                          customerName: detail.customer_name,
                          orderNumber: detail.order_number,
                          status: detail.status,
                          fulfillmentMode: detail.fulfillment_mode,
                        })
                      )
                      return url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300"
                          data-testid="pedido-whatsapp"
                        >
                          <MessageCircle size={14} aria-hidden />
                          WhatsApp
                        </a>
                      ) : null
                    })()}
                  </dd>
                </div>
                {detail.customer_email && (
                  <div>
                    <dt className="text-gray-400 text-xs">Email</dt>
                    <dd className="font-semibold break-all">{detail.customer_email}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-400 text-xs">Creado</dt>
                  <dd>{new Date(detail.created_at).toLocaleString('es-AR')}</dd>
                </div>
                <div>
                  <dt className="text-gray-400 text-xs">Actualizado</dt>
                  <dd>{new Date(detail.updated_at).toLocaleString('es-AR')}</dd>
                </div>
                {detail.coupon_code && (
                  <div>
                    <dt className="text-gray-400 text-xs">Cupón</dt>
                    <dd>
                      {detail.coupon_code} (−{detail.coupon_discount_percentage ?? 0}%)
                    </dd>
                  </div>
                )}
              </dl>

              {detail.notes && (
                <div className="rounded-xl bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm">
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
                <div className="rounded-xl bg-pink-50 dark:bg-pink-950/20 px-3 py-2 text-sm">
                  <p className="text-xs text-gray-400 mb-1">
                    {detail.fulfillment_mode === 'retiro'
                      ? 'Retiro en el local'
                      : detail.fulfillment_mode === 'coordinar'
                        ? 'Entrega a coordinar'
                        : 'Envío cotizado'}
                  </p>
                  {detail.fulfillment_mode === 'envio' ? (
                    <>
                      <p className="font-semibold">
                        {detail.shipping_carrier_description} · {detail.shipping_service_description}
                      </p>
                      {detail.shipping_destination_street && detail.shipping_destination_number ? (
                        <div className="space-y-0.5">
                          <p><span className="text-gray-500">Dirección:</span> {detail.shipping_destination_street} {detail.shipping_destination_number}</p>
                          <p><span className="text-gray-500">Localidad:</span> {detail.shipping_destination_city}, {detail.shipping_destination_state}</p>
                          <p><span className="text-gray-500">Código postal:</span> {detail.shipping_destination_postal_code}</p>
                        </div>
                      ) : (
                        <p>
                          {detail.shipping_destination_formatted_address
                            || `CP ${detail.shipping_destination_postal_code}, ${detail.shipping_destination_city}, ${detail.shipping_destination_state}`}
                        </p>
                      )}
                      <p>
                        ${formatPesoARExact(detail.shipping_amount)}
                        {detail.shipping_delivery_estimate ? ` · ${detail.shipping_delivery_estimate}` : ''}
                      </p>
                    </>
                  ) : (
                    <p className="font-semibold">
                      {detail.fulfillment_mode === 'retiro'
                        ? 'Pasás a buscarlo. Coordinamos el horario por WhatsApp.'
                        : 'Si estás cerca, lo vemos por WhatsApp.'}
                      {detail.shipping_destination_formatted_address
                        ? ` · ${detail.shipping_destination_formatted_address}`
                        : ''}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <a
                  href={panelHref({ tab: 'returns', channel: 'catalog', orderId: detail.id })}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800"
                  data-testid="pedido-open-return"
                >
                  Registrar devolución
                </a>
                <a
                  href={panelHref({ tab: 'margin_reports', channel: 'catalog' })}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Ver margen del catálogo
                </a>
              </div>

              {detail.returns.length > 0 && (
                <div data-testid="pedido-returns">
                  <h4 className="text-sm font-bold mb-2">Devoluciones</h4>
                  <ul className="space-y-2">
                    {detail.returns.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-xl border border-gray-100 dark:border-gray-800 px-3 py-2 text-sm"
                      >
                        <p className="font-semibold">
                          {catalogReturnLabel(item.return_number)} · ${formatPesoAR(item.refund_total)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {catalogRefundActionLabel(item.refund_action)}
                          {item.restock ? ' · stock reintegrado' : ' · sin reintegro de stock'}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{item.reason}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h4 className="text-sm font-bold mb-2">Líneas</h4>
                <ul className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-100 dark:border-gray-800">
                  {detail.items.map((it) => (
                    <li key={it.id} className="px-3 py-2 text-sm flex justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">
                          {it.name_snapshot}{' '}
                          <span className="text-gray-400 font-normal">×{it.quantity}</span>
                        </p>
                        {it.variant_snapshot && (
                          <p className="text-xs text-gray-400">{it.variant_snapshot}</p>
                        )}
                        {it.line_type === 'combo' && it.combo_components_snapshot.length > 0 && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {it.combo_components_snapshot
                              .map((c) => `${c.product_name}×${c.quantity}`)
                              .join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold">${formatPesoAR(it.line_subtotal)}</p>
                        <p className="text-xs text-gray-400">
                          ${formatPesoAR(it.unit_price)} c/u
                          {it.discount_percentage > 0 ? ` (−${it.discount_percentage}%)` : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 text-sm space-y-0.5 text-right">
                  <p>
                    Subtotal: <strong>${formatPesoAR(detail.subtotal)}</strong>
                  </p>
                  {detail.discount_total > 0 && (
                    <p>
                      Descuento: <strong>−${formatPesoAR(detail.discount_total)}</strong>
                    </p>
                  )}
                  {detail.shipping_amount > 0 && (
                    <p>
                      Envío: <strong>${formatPesoARExact(detail.shipping_amount)}</strong>
                    </p>
                  )}
                  <p className="text-base">
                    Total: <strong>${formatPesoARExact(detail.total)}</strong>
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold mb-2">Historial de estados</h4>
                <ol className="space-y-2">
                  {detail.events.map((ev) => (
                    <li
                      key={ev.id}
                      className="text-xs sm:text-sm flex gap-2 text-gray-600 dark:text-gray-300"
                    >
                      <span className="text-gray-400 shrink-0">
                        {new Date(ev.created_at).toLocaleString('es-AR')}
                      </span>
                      <span>
                        {ev.from_status
                          ? `${orderStatusLabel(ev.from_status)} → ${orderStatusLabel(ev.to_status)}`
                          : orderStatusLabel(ev.to_status)}
                        {ev.reason ? ` · ${ev.reason}` : ''}
                        <span className="text-gray-400"> · {actorLabel(ev.actor_kind)}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              {cancelOpen && (
                <div
                  className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 p-3 space-y-2"
                  data-testid="pedido-cancel-form"
                >
                  <label
                    htmlFor="pedido-cancel-reason"
                    className="block text-xs font-bold text-rose-800 dark:text-rose-200"
                  >
                    Motivo de cancelación *
                  </label>
                  <textarea
                    id="pedido-cancel-reason"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    maxLength={300}
                    rows={2}
                    className="w-full rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-gray-950 px-2 py-1.5 text-sm"
                    data-testid="pedido-cancel-reason"
                    disabled={actionLoading}
                  />
                  {cancelError && (
                    <p className="text-xs text-rose-600" role="alert">
                      {cancelError}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-xl bg-rose-600 text-white px-3 py-2 text-sm font-bold disabled:opacity-60"
                      disabled={actionLoading}
                      onClick={() => void confirmCancel()}
                      data-testid="pedido-cancel-confirm"
                    >
                      Confirmar cancelación
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-semibold"
                      disabled={actionLoading}
                      onClick={() => {
                        setCancelOpen(false)
                        setCancelError(null)
                      }}
                    >
                      Volver
                    </button>
                  </div>
                </div>
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
