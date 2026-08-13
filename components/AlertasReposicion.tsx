'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Clock,
  Loader2,
  Package,
  RefreshCw,
  Search,
  UserCheck,
  X,
} from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useConfirm } from '@/hooks/useConfirm'
import {
  countOpenStockAlerts,
  getStockAlertDetail,
  listStockAlerts,
  transitionStockAlert,
} from '@/lib/domain/stockAlerts/browserStockAlerts'
import {
  canTransitionStockAlert,
  isActiveStockAlertStatus,
  resolutionKindLabel,
  stockAlertStatusLabel,
  STOCK_ALERT_STATUSES,
  type StockAlertStatus,
} from '@/lib/domain/stockAlerts/states'
import type { StockAlertDetail, StockAlertListItem } from '@/lib/domain/stockAlerts/types'
import { isAppError, toUserMessage } from '@/lib/domain/errors'
import { useToast } from '@/context/ToastContext'
import { logStructured, createRequestId } from '@/lib/observability/logger'
import { ObservabilityEvent } from '@/lib/observability/events'

const STATUS_FILTERS: Array<StockAlertStatus | 'active' | 'all'> = [
  'active',
  'open',
  'in_progress',
  'resolved',
  'dismissed',
  'all',
]

function statusBadgeClass(status: StockAlertStatus): string {
  switch (status) {
    case 'open':
      return 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'
    case 'in_progress':
      return 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100'
    case 'resolved':
      return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100'
    case 'dismissed':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

function ageLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours} h`
  const days = Math.floor(hours / 24)
  return `${days} d`
}

function filterLabel(s: StockAlertStatus | 'active' | 'all'): string {
  if (s === 'active') return 'Activas'
  if (s === 'all') return 'Todas'
  return stockAlertStatusLabel(s)
}

function nextActions(status: StockAlertStatus): StockAlertStatus[] {
  return STOCK_ALERT_STATUSES.filter(
    (s) => s !== status && canTransitionStockAlert(status, s)
  )
}

export default function AlertasReposicion() {
  const { showToast } = useToast()
  const { confirm, confirmProps } = useConfirm()
  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts] = useState<StockAlertListItem[]>([])
  const [openCount, setOpenCount] = useState(0)
  const [statusFilter, setStatusFilter] = useState<StockAlertStatus | 'active' | 'all'>(
    'active'
  )
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<StockAlertDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [noteOpen, setNoteOpen] = useState<'resolved' | 'dismissed' | null>(null)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const [rows, count] = await Promise.all([
        listStockAlerts({ status: statusFilter, query }),
        countOpenStockAlerts(),
      ])
      setAlerts(rows)
      setOpenCount(count)
    } catch (err) {
      showToast('error', toUserMessage(err, 'No se pudieron cargar las alertas.'))
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
      setNoteOpen(null)
      setNote('')
      setNoteError(null)
      try {
        const d = await getStockAlertDetail(id)
        setDetail(d)
      } catch (err) {
        showToast('error', toUserMessage(err, 'No se pudo cargar el detalle.'))
        setSelectedId(null)
      } finally {
        setDetailLoading(false)
      }
    },
    [showToast]
  )

  const applyTransition = useCallback(
    async (to: StockAlertStatus, noteText: string | null) => {
      if (!detail) return
      setActionLoading(true)
      const requestId = createRequestId()
      try {
        const result = await transitionStockAlert(detail.id, to, noteText)
        const eventName =
          to === 'in_progress'
            ? ObservabilityEvent.STOCK_ALERT_TAKEN
            : to === 'resolved'
              ? ObservabilityEvent.STOCK_ALERT_RESOLVED
              : to === 'dismissed'
                ? ObservabilityEvent.STOCK_ALERT_DISMISSED
                : ObservabilityEvent.STOCK_ALERT_TAKEN
        logStructured({
          event: eventName,
          level: 'info',
          requestId,
          route: '/panel/alertas-reposicion',
          meta: {
            status: result.status,
            productId: result.product_id,
            idempotent: result.idempotent_replay,
            resolutionKind: result.resolution_kind,
          },
        })
        showToast(
          'success',
          `Alerta: ${stockAlertStatusLabel(result.status)}`
        )
        setNoteOpen(null)
        setNote('')
        const d = await getStockAlertDetail(detail.id)
        setDetail(d)
        await loadList()
      } catch (err) {
        logStructured({
          event: ObservabilityEvent.STOCK_ALERT_TRANSITION_FAILED,
          level: 'warn',
          requestId,
          route: '/panel/alertas-reposicion',
          code: isAppError(err) ? String(err.message).slice(0, 64) : 'transition_failed',
        })
        showToast('error', toUserMessage(err, 'No se pudo actualizar la alerta.'))
      } finally {
        setActionLoading(false)
      }
    },
    [detail, showToast, loadList]
  )

  const runTransition = useCallback(
    async (to: StockAlertStatus) => {
      if (!detail) return
      if (to === 'resolved' || to === 'dismissed') {
        setNoteOpen(to)
        setNote('')
        setNoteError(null)
        return
      }
      if (to === 'in_progress') {
        const ok = await confirm({
          title: '¿Tomar esta alerta?',
          description: `Quedarás como responsable de ${detail.product_name || `producto #${detail.product_id}`}.`,
          confirmLabel: 'Tomar',
          cancelLabel: 'Volver',
          danger: false,
        })
        if (!ok) return
        await applyTransition('in_progress', null)
      }
    },
    [detail, confirm, applyTransition]
  )

  const confirmNoteAction = useCallback(async () => {
    if (!noteOpen) return
    const text = note.trim()
    if (text.length < 3) {
      setNoteError('Escribí al menos 3 caracteres.')
      return
    }
    const ok = await confirm({
      title:
        noteOpen === 'dismissed'
          ? '¿Descartar esta alerta?'
          : '¿Marcar como resuelta?',
      description:
        noteOpen === 'dismissed'
          ? 'La alerta queda cerrada sin reposición registrada. Si el stock sigue bajo, no se reabre sola hasta un nuevo ciclo.'
          : 'Confirmá que gestionaste la reposición. Si el stock aún está bajo, el sistema puede abrir un ciclo nuevo al sincronizar.',
      confirmLabel: noteOpen === 'dismissed' ? 'Descartar' : 'Resolver',
      cancelLabel: 'Volver',
      danger: noteOpen === 'dismissed',
    })
    if (!ok) return
    await applyTransition(noteOpen, text)
  }, [noteOpen, note, confirm, applyTransition])

  const actions = useMemo(
    () => (detail ? nextActions(detail.status) : []),
    [detail]
  )

  const goInventory = (productId: number) => {
    window.history.pushState({}, '', `?tab=inventory&product=${productId}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
    // Fallback: query param para Inventario si lo soporta; si no, al menos tab inventory
    const url = new URL(window.location.href)
    url.searchParams.set('tab', 'inventory')
    url.searchParams.set('highlight', String(productId))
    window.history.replaceState({}, '', url.toString())
    showToast('info', `Producto #${productId} — abrí Inventario para editarlo.`)
  }

  return (
    <div className="flex flex-col gap-5 animate-fade-in pb-8" data-testid="alertas-reposicion-panel">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-50">
            Alertas de reposición
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Stock ≤ mínimo · sin compras automáticas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 px-3 py-1 text-sm font-bold"
            data-testid="alertas-open-count"
          >
            <AlertTriangle size={14} aria-hidden />
            {openCount} activas
          </span>
          <button
            type="button"
            onClick={() => void loadList()}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800"
            data-testid="alertas-refresh"
          >
            <RefreshCw size={16} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <label className="relative flex-1">
          <span className="sr-only">Buscar alertas</span>
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Producto, marca o categoría"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-9 pr-3 py-2.5 text-sm"
            data-testid="alertas-search"
          />
        </label>
        <label className="sm:w-48">
          <span className="sr-only">Filtrar por estado</span>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as StockAlertStatus | 'active' | 'all')
            }
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm"
            data-testid="alertas-status-filter"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {filterLabel(s)}
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
          ) : alerts.length === 0 ? (
            <div className="py-16 px-6 text-center text-gray-500">
              <Package className="mx-auto mb-2 opacity-50" />
              No hay alertas con estos filtros.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800" role="list">
              {alerts.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => void openDetail(a.id)}
                    className={[
                      'w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-amber-50/60 dark:hover:bg-amber-950/20 transition-colors',
                      selectedId === a.id ? 'bg-amber-50 dark:bg-amber-950/30' : '',
                    ].join(' ')}
                    data-testid={`alerta-row-${a.product_id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 dark:text-gray-50 truncate">
                          {a.product_name || `Producto #${a.product_id}`}
                        </span>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${statusBadgeClass(a.status)}`}
                        >
                          {stockAlertStatusLabel(a.status)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Stock {a.stock_current} · mín {a.min_stock_current} · sugerido{' '}
                        {a.suggested_qty}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <Clock size={12} aria-hidden />
                        {ageLabel(a.opened_at)}
                        {a.product_brand ? ` · ${a.product_brand}` : ''}
                        {a.category_name ? ` · ${a.category_name}` : ''}
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
              Seleccioná una alerta para ver el detalle.
            </p>
          )}
          {selectedId && detailLoading && (
            <div className="flex items-center justify-center gap-2 py-16 text-pink-500">
              <Loader2 className="animate-spin" size={20} />
              Cargando detalle…
            </div>
          )}
          {detail && !detailLoading && (
            <div className="flex flex-col gap-4" data-testid="alerta-detail">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-xl font-extrabold text-gray-900 dark:text-gray-50">
                    {detail.product_name || `Producto #${detail.product_id}`}
                  </h3>
                  <span
                    className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full ${statusBadgeClass(detail.status)}`}
                  >
                    {stockAlertStatusLabel(detail.status)}
                  </span>
                  {detail.resolution_kind && (
                    <p className="text-xs text-gray-500 mt-1">
                      {resolutionKindLabel(detail.resolution_kind)}
                    </p>
                  )}
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

              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-gray-400 text-xs">Stock actual</dt>
                  <dd className="font-extrabold text-lg tabular-nums">{detail.stock_current}</dd>
                </div>
                <div>
                  <dt className="text-gray-400 text-xs">Mínimo</dt>
                  <dd className="font-semibold tabular-nums">{detail.min_stock_current}</dd>
                </div>
                <div>
                  <dt className="text-gray-400 text-xs">Sugerido</dt>
                  <dd className="font-semibold tabular-nums text-pink-600 dark:text-pink-400">
                    +{detail.suggested_qty}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-400 text-xs">Déficit</dt>
                  <dd className="font-semibold tabular-nums">{detail.deficit}</dd>
                </div>
                <div>
                  <dt className="text-gray-400 text-xs">Antigüedad</dt>
                  <dd>{ageLabel(detail.opened_at)}</dd>
                </div>
                <div>
                  <dt className="text-gray-400 text-xs">ID producto</dt>
                  <dd className="font-mono text-xs">#{detail.product_id}</dd>
                </div>
              </dl>

              <p className="text-xs text-gray-500 rounded-xl bg-gray-50 dark:bg-gray-900 px-3 py-2">
                Sugerencia = reponer hasta{' '}
                <strong>max(mín×2, mín+1)</strong> (si mín=0 → 1). No es una orden de
                compra automática.
              </p>

              <button
                type="button"
                className="self-start text-sm font-bold text-pink-600 dark:text-pink-400 underline-offset-2 hover:underline"
                onClick={() => goInventory(detail.product_id)}
                data-testid="alerta-go-inventory"
              >
                Ir a inventario (producto #{detail.product_id})
              </button>

              {noteOpen && (
                <div
                  className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2"
                  data-testid="alerta-note-form"
                >
                  <label
                    htmlFor="alerta-note"
                    className="block text-xs font-bold text-gray-600 dark:text-gray-300"
                  >
                    {noteOpen === 'dismissed' ? 'Motivo de descarte *' : 'Nota de resolución *'}
                  </label>
                  <textarea
                    id="alerta-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={500}
                    rows={2}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1.5 text-sm"
                    data-testid="alerta-note"
                    disabled={actionLoading}
                  />
                  {noteError && (
                    <p className="text-xs text-rose-600" role="alert">
                      {noteError}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={[
                        'rounded-xl px-3 py-2 text-sm font-bold text-white disabled:opacity-60',
                        noteOpen === 'dismissed' ? 'bg-rose-600' : 'bg-emerald-600',
                      ].join(' ')}
                      disabled={actionLoading}
                      onClick={() => void confirmNoteAction()}
                      data-testid="alerta-note-confirm"
                    >
                      {noteOpen === 'dismissed' ? 'Confirmar descarte' : 'Confirmar resolución'}
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-semibold"
                      disabled={actionLoading}
                      onClick={() => {
                        setNoteOpen(null)
                        setNoteError(null)
                      }}
                    >
                      Volver
                    </button>
                  </div>
                </div>
              )}

              {actions.length > 0 && !noteOpen && isActiveStockAlertStatus(detail.status) && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {actions.map((to) => (
                    <button
                      key={to}
                      type="button"
                      disabled={actionLoading}
                      onClick={() => void runTransition(to)}
                      className={[
                        'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-colors text-white',
                        to === 'dismissed'
                          ? 'bg-rose-600 hover:bg-rose-700'
                          : to === 'resolved'
                            ? 'bg-emerald-600 hover:bg-emerald-700'
                            : 'bg-sky-600 hover:bg-sky-700',
                        actionLoading ? 'opacity-60 cursor-not-allowed' : '',
                      ].join(' ')}
                      data-testid={`alerta-transition-${to}`}
                    >
                      {to === 'in_progress' ? (
                        <UserCheck size={16} />
                      ) : to === 'resolved' ? (
                        <Check size={16} />
                      ) : (
                        <X size={16} />
                      )}
                      {to === 'in_progress'
                        ? 'Tomar'
                        : to === 'resolved'
                          ? 'Resolver'
                          : 'Descartar'}
                    </button>
                  ))}
                </div>
              )}

              <div>
                <h4 className="text-sm font-bold mb-2">Historial</h4>
                <ol className="space-y-2" data-testid="alerta-history">
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
                          ? `${stockAlertStatusLabel(ev.from_status)} → ${stockAlertStatusLabel(ev.to_status)}`
                          : stockAlertStatusLabel(ev.to_status)}
                        {ev.reason ? ` · ${ev.reason}` : ''}
                        <span className="text-gray-400"> · {ev.actor_kind}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog {...confirmProps} testId="confirm-alerta" />
    </div>
  )
}
