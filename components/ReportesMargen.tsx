'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, BarChart3, CheckCircle2, RefreshCw } from 'lucide-react'
import { loadMarginReport } from '@/lib/domain/marginReports/browserMarginReports'
import { formatMarginMoney, marginPeriodRange } from '@/lib/domain/marginReports/rules'
import type { MarginChannel, MarginPeriod, MarginReport } from '@/lib/domain/marginReports/types'
import { panelHref } from '@/lib/appNavigation'

const periods: Array<{ id: MarginPeriod; label: string }> = [
  { id: 'month', label: 'Este mes' },
  { id: '30d', label: '30 días' },
  { id: '90d', label: '90 días' },
  { id: '365d', label: '1 año' },
]

const number = new Intl.NumberFormat('es-AR')
const date = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' })

function marginLabel(value: number | null) {
  return value == null ? 'Sin datos' : `${value.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const channels: Array<{ id: MarginChannel; label: string }> = [
  { id: 'combined', label: 'Combinado' },
  { id: 'pos', label: 'Venta en local' },
  { id: 'catalog', label: 'Pedido online' },
]

export default function ReportesMargen() {
  const searchParams = useSearchParams()
  const [period, setPeriod] = useState<MarginPeriod>('month')
  const [channel, setChannel] = useState<MarginChannel>('combined')
  const [report, setReport] = useState<MarginReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    const raw = searchParams.get('channel')
    if (raw === 'pos' || raw === 'catalog' || raw === 'combined') setChannel(raw)
  }, [searchParams])

  const refresh = useCallback(async (selected: MarginPeriod, selectedChannel: MarginChannel) => {
    const currentRequest = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const range = marginPeriodRange(selected)
      const nextReport = await loadMarginReport(range.from, range.to, selectedChannel)
      if (currentRequest === requestId.current) setReport(nextReport)
    } catch (cause) {
      if (currentRequest === requestId.current) {
        setError(cause instanceof Error ? cause.message : 'No se pudo cargar el reporte.')
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh(period, channel)
  }, [period, channel, refresh])

  const maxDaily = useMemo(
    () => Math.max(1, ...(report?.daily.map((row) => row.net_revenue) ?? [])),
    [report]
  )

  return (
    <section className="flex flex-col gap-5 pb-5 animate-fade-in" data-testid="margin-report-panel">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-50">
            Margen real
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Margen de mostrador, catálogo y total. Si falta un costo, no se inventa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Período del reporte">
          {periods.map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid={`margin-period-${item.id}`}
              aria-pressed={period === item.id}
              onClick={() => setPeriod(item.id)}
              className={`rounded-xl px-3 py-2 text-xs font-extrabold transition-colors ${
                period === item.id
                  ? 'bg-pink-600 text-white'
                  : 'bg-white dark:bg-zinc-900 text-gray-600 dark:text-gray-300 border border-pink-100 dark:border-white/10'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-gray-200 dark:border-gray-700 p-1 bg-white dark:bg-zinc-900" aria-label="Origen del margen">
        {channels.map((item) => (
          <button
            key={item.id}
            type="button"
            data-testid={`margin-channel-${item.id}`}
            aria-pressed={channel === item.id}
            onClick={() => setChannel(item.id)}
            className={`rounded-lg px-3 py-2 text-xs font-extrabold ${
              channel === item.id ? 'bg-pink-600 text-white' : 'text-gray-600 dark:text-gray-300'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading && !report && (
        <div className="min-h-56 grid place-items-center rounded-2xl border border-pink-100 dark:border-white/10 bg-white dark:bg-zinc-900">
          <RefreshCw className="w-6 h-6 text-pink-500 animate-spin" aria-label="Cargando reporte" />
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30 p-4 flex items-center justify-between gap-3" role="alert">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>
          <button type="button" onClick={() => void refresh(period, channel)} className="text-sm font-extrabold text-red-700 dark:text-red-300">
            Reintentar
          </button>
        </div>
      )}

      {report && (
        <>
          {report.pos && report.catalog && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <article className="rounded-2xl border border-pink-100 dark:border-white/10 bg-white dark:bg-zinc-900 p-4">
                <p className="text-xs font-bold uppercase text-gray-500">Margen mostrador</p>
                <p className="mt-1 text-xl font-black">{formatMarginMoney(report.pos.gross_margin)}</p>
              </article>
              <article className="rounded-2xl border border-pink-100 dark:border-white/10 bg-white dark:bg-zinc-900 p-4">
                <p className="text-xs font-bold uppercase text-gray-500">Margen catálogo</p>
                <p className="mt-1 text-xl font-black">{formatMarginMoney(report.catalog.gross_margin)}</p>
              </article>
              <article className="rounded-2xl border border-pink-100 dark:border-white/10 bg-white dark:bg-zinc-900 p-4">
                <p className="text-xs font-bold uppercase text-gray-500">Margen total</p>
                <p className="mt-1 text-xl font-black">{formatMarginMoney(report.combined?.gross_margin ?? report.summary.gross_margin)}</p>
              </article>
            </div>
          )}

          {!!report.pending_cost_orders?.length && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30 p-4" data-testid="margin-pending-cost">
              <p className="text-sm font-extrabold">Pedidos con costo pendiente de revisar</p>
              <ul className="mt-2 space-y-1 text-sm">
                {report.pending_cost_orders.map((order) => (
                  <li key={order.id}>
                    <a href={panelHref({ tab: 'orders', orderId: order.id })} className="font-bold text-amber-800 dark:text-amber-200 underline-offset-2 hover:underline">
                      {order.order_number}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ['Ventas netas', formatMarginMoney(report.summary.net_revenue), 'margin-kpi-net'],
              ['Costo vendido', formatMarginMoney(report.summary.known_cogs), 'margin-kpi-cogs'],
              ['Margen bruto', formatMarginMoney(report.summary.gross_margin), 'margin-kpi-gross'],
              ['Margen %', marginLabel(report.summary.margin_percent), 'margin-kpi-percent'],
            ].map(([label, value, testId]) => (
              <article key={label} data-testid={testId} className="rounded-2xl border border-pink-100/80 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
                <p className="mt-2 text-xl sm:text-2xl font-black tracking-tight text-gray-900 dark:text-white">{value}</p>
              </article>
            ))}
          </div>

          <div className={`rounded-2xl border p-4 flex gap-3 ${report.summary.margin_complete ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30' : 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30'}`}>
            {report.summary.margin_complete
              ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              : <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />}
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                Cobertura de costos: {report.summary.cost_coverage_percent.toLocaleString('es-AR')}%
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                {number.format(report.summary.exact_lines)} líneas exactas · {number.format(report.summary.estimated_lines)} estimadas · {number.format(report.summary.missing_cost_lines)} sin costo.
                {!report.summary.margin_complete && ' El margen total se oculta hasta completar los costos faltantes.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl bg-gray-50 dark:bg-zinc-900 p-3"><p className="text-xs text-gray-500">Ventas</p><p className="font-black">{number.format(report.summary.sale_count)}</p></div>
            <div className="rounded-xl bg-gray-50 dark:bg-zinc-900 p-3"><p className="text-xs text-gray-500">Unidades netas</p><p className="font-black">{number.format(report.summary.units_sold - report.summary.units_returned)}</p></div>
            <div className="rounded-xl bg-gray-50 dark:bg-zinc-900 p-3"><p className="text-xs text-gray-500">Descuentos</p><p className="font-black">{formatMarginMoney(report.summary.discount_total)}</p></div>
            <div className="rounded-xl bg-gray-50 dark:bg-zinc-900 p-3"><p className="text-xs text-gray-500">Reintegros</p><p className="font-black">{formatMarginMoney(report.summary.refund_total)}</p></div>
          </div>

          <article className="rounded-2xl border border-pink-100 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4"><BarChart3 className="w-5 h-5 text-pink-600" aria-hidden /><h3 className="font-extrabold">Ventas netas por día</h3></div>
            {report.daily.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">No hay ventas en este período.</p>
            ) : (
              <div className="flex items-end gap-1.5 h-40 overflow-x-auto" aria-label="Gráfico de ventas netas por día">
                {report.daily.map((row) => (
                  <div key={row.date} className="group flex flex-col items-center justify-end gap-1 min-w-7 h-full" title={`${row.date}: ${formatMarginMoney(row.net_revenue)}`}>
                    <span className="sr-only">{row.date}: {formatMarginMoney(row.net_revenue)}</span>
                    <div className="w-full rounded-t-md bg-gradient-to-t from-pink-600 to-fuchsia-400 min-h-1" style={{ height: `${Math.max(3, row.net_revenue / maxDaily * 100)}%` }} />
                    <span className="text-[9px] text-gray-400 whitespace-nowrap">{date.format(parseLocalDate(row.date))}</span>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-pink-100 dark:border-white/10 bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-white/10"><h3 className="font-extrabold">Productos y combos</h3><p className="text-xs text-gray-500 mt-1">Ordenados por venta neta.</p></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-gray-500 bg-gray-50 dark:bg-zinc-950/60"><tr><th className="px-4 py-3">Artículo</th><th className="px-4 py-3 text-right">Unidades</th><th className="px-4 py-3 text-right">Venta neta</th><th className="px-4 py-3 text-right">Margen</th></tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                  {report.items.map((item, index) => (
                    <tr key={`${item.product_id ?? `c${item.combo_id}`}-${index}`} data-testid={`margin-item-${index}`}>
                      <td className="px-4 py-3"><p className="font-bold text-gray-900 dark:text-gray-100">{item.name}</p><p className={`text-[11px] font-semibold mt-0.5 ${!item.margin_complete ? 'text-amber-600' : item.has_estimated_cost ? 'text-sky-600' : 'text-emerald-600'}`}>{item.channel === 'catalog' ? 'Pedido online · ' : item.channel === 'pos' ? 'Venta en local · ' : ''}{!item.margin_complete ? 'Costo no disponible' : item.has_estimated_cost ? 'Costo estimado' : 'Costo histórico'}</p></td>
                      <td className="px-4 py-3 text-right font-semibold">{number.format(item.net_units)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatMarginMoney(item.net_revenue)}</td>
                      <td className="px-4 py-3 text-right"><p className="font-extrabold">{formatMarginMoney(item.gross_margin)}</p><p className="text-xs text-gray-500">{marginLabel(item.margin_percent)}</p></td>
                    </tr>
                  ))}
                  {report.items.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-500">No hay artículos para mostrar.</td></tr>}
                </tbody>
              </table>
            </div>
          </article>
        </>
      )}
    </section>
  )
}
