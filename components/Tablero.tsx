'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { supabase, Producto, Venta, ItemVenta } from '@/lib/supabase'

const TableroVentasChart = dynamic(() => import('@/components/TableroVentasChart'), {
    ssr: false,
    loading: () => (
        <div
            className="flex-1 min-h-[280px] w-full pt-2 rounded-xl bg-pink-50/40 dark:bg-gray-800/40 animate-pulse"
            aria-hidden
        />
    ),
})
import { Package, TrendingUp, AlertTriangle, DollarSign, Receipt, Settings, Wallet, Store, ClipboardList } from 'lucide-react'
import { format, subDays, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { PastelCard } from '@/components/ui/PastelCard'
import TarjetaEstadistica from '@/components/Tablero/TarjetaEstadistica'
import TableroSkeleton from '@/components/Tablero/TableroSkeleton'
import ModalDetalleVenta from '@/components/Tablero/ModalDetalleVenta'
import ModalStockCritico from '@/components/Tablero/ModalStockCritico'
import ModalPeriodoIngresos, { type PeriodoIngresos } from '@/components/Tablero/ModalPeriodoIngresos'
import { useTheme } from '@/context/ThemeContext'
import type { PanelNavigate } from '@/lib/appNavigation'
import { fetchPanelBadges } from '@/lib/domain/panel/browserPanelBadges'
import { listCatalogCollections } from '@/lib/domain/finance/browserFinance'
import { paymentMethodLabel, type PaymentMethodCode } from '@/lib/domain/payments/states'

type TableroProps = {
    onNavigate?: PanelNavigate
}

type DashboardKpi = {
    sales_total: number
    sales_count: number
    incomes_total: number
    incomes_count: number
    expenses_total: number
    catalog_inflow: number
}

const KPI_ZERO: DashboardKpi = {
    sales_total: 0,
    sales_count: 0,
    incomes_total: 0,
    incomes_count: 0,
    expenses_total: 0,
    catalog_inflow: 0,
}

export default function Tablero({ onNavigate }: TableroProps) {
    const router = useRouter()
    const { theme } = useTheme()
    const [productos, setProductos] = useState<Producto[]>([])
    const [kpi, setKpi] = useState<DashboardKpi>(KPI_ZERO)
    const [ventasRecientes, setVentasRecientes] = useState<Venta[]>([])
    const [ventasPorDia, setVentasPorDia] = useState<{ fecha: string; total: number; cantidad: number }[]>([])
    /** true = gráfico de barras por mes (período Total); false = por día (7d / 30d). */
    const [ventasChartEsMensual, setVentasChartEsMensual] = useState(false)
    const [periodoIngresos, setPeriodoIngresos] = useState<PeriodoIngresos>('total')
    const [cargando, setCargando] = useState(true)
    const [dashboardError, setDashboardError] = useState<string | null>(null)
    const [mostrarAlertas, setMostrarModalAlertas] = useState(false)
    const [pedidosAbiertos, setPedidosAbiertos] = useState(0)
    const [catalogRecientes, setCatalogRecientes] = useState<Array<{
        id: string
        order_number: string
        customer_name: string
        method: string
        amount_due: number
        approved_at: string | null
        created_at: string
    }>>([])

    const [mostrarModalPeriodo, setMostrarModalPeriodo] = useState(false)
    const [detalleVenta, setDetalleVenta] = useState<Venta | null>(null)
    const [itemsDetalleVenta, setItemsDetalleVenta] = useState<ItemVenta[]>([])
    const [cargandoDetalleVenta, setCargandoDetalleVenta] = useState(false)

    const refrescarMetricas = useCallback(async () => {
        const corte =
            periodoIngresos === '7d'
                ? subDays(new Date(), 7)
                : periodoIngresos === '30d'
                  ? subDays(new Date(), 30)
                  : null
        const pSince = corte ? corte.toISOString() : null

        const { data: kpiRaw, error: kpiErr } = await supabase.rpc('dashboard_finance_kpis', {
            p_since: pSince,
        })
        if (kpiErr) {
            console.warn('[tablero] dashboard_finance_kpis', kpiErr.message)
            setDashboardError('No se pudieron actualizar los totales del negocio.')
        }
        if (!kpiErr && kpiRaw && typeof kpiRaw === 'object') {
            const o = kpiRaw as Record<string, unknown>
            setKpi((prev) => ({
                ...prev,
                sales_total: Number(o.sales_total ?? 0),
                sales_count: Number(o.sales_count ?? 0),
                incomes_total: Number(o.incomes_total ?? 0),
                incomes_count: Number(o.incomes_count ?? 0),
                expenses_total: Number(o.expenses_total ?? 0),
            }))
        }

        const today = new Date()
        const toLocal = new Date(today.getTime() - today.getTimezoneOffset() * 60_000)
            .toISOString()
            .slice(0, 10)
        const from =
            periodoIngresos === '7d'
                ? new Date(today.getTime() - 7 * 86400000 - today.getTimezoneOffset() * 60_000)
                    .toISOString()
                    .slice(0, 10)
                : periodoIngresos === '30d'
                  ? new Date(today.getTime() - 30 * 86400000 - today.getTimezoneOffset() * 60_000)
                    .toISOString()
                    .slice(0, 10)
                  : '2016-01-01'
        try {
            const collections = await listCatalogCollections(from, toLocal)
            setKpi((prev) => ({ ...prev, catalog_inflow: collections.total }))
            setCatalogRecientes(collections.items)
        } catch (error) {
            console.warn('[tablero] catalog collections', error)
            setDashboardError('No se pudieron actualizar los cobros del catálogo.')
        }

        if (periodoIngresos === 'total') {
            setVentasChartEsMensual(true)
            const { data: monthlyRaw, error: monthlyErr } = await supabase.rpc('dashboard_sales_monthly_total_span')
            if (monthlyErr) {
                console.warn('[tablero] dashboard_sales_monthly_total_span', monthlyErr.message)
                setDashboardError('No se pudo actualizar el gráfico de ventas.')
            } else {
                const rows = (monthlyRaw ?? []) as Array<{
                    month_start: string
                    total: unknown
                    sale_count: unknown
                }>
                setVentasPorDia(
                    rows.map((row) => ({
                        fecha: format(parseISO(`${row.month_start}T12:00:00`), 'MMM yyyy', { locale: es }),
                        total: Number(row.total ?? 0),
                        cantidad: Number(row.sale_count ?? 0),
                    }))
                )
            }
        } else {
            setVentasChartEsMensual(false)
            const diasChart = periodoIngresos === '30d' ? 30 : 7
            const { data: dailyRaw, error: dailyErr } = await supabase.rpc('dashboard_sales_daily', {
                p_days: diasChart,
            })
            if (dailyErr) {
                console.warn('[tablero] dashboard_sales_daily', dailyErr.message)
                setDashboardError('No se pudo actualizar el gráfico de ventas.')
            } else {
                const rows = (dailyRaw ?? []) as Array<{
                    sale_day: string
                    total: unknown
                    sale_count: unknown
                }>
                const fmt = periodoIngresos === '30d' ? 'd MMM' : 'EEE d'
                setVentasPorDia(
                    rows.map((row) => ({
                        fecha: format(parseISO(`${row.sale_day}T12:00:00`), fmt, { locale: es }),
                        total: Number(row.total ?? 0),
                        cantidad: Number(row.sale_count ?? 0),
                    }))
                )
            }
        }

        let vq = supabase
            .from('sales')
            .select(
                'id, sale_date, total, payment_method, customer_name, customer_id, notes, status, created_at'
            )
            .neq('status', 'pending_payment')
            .order('created_at', { ascending: false })
            .limit(5)
        if (corte) vq = vq.gte('created_at', corte.toISOString())
        const { data: vrec, error: vErr } = await vq
        if (vErr) setDashboardError('No se pudieron actualizar las ventas recientes.')
        else setVentasRecientes((vrec ?? []) as unknown as Venta[])
    }, [periodoIngresos])

    const obtenerProductos = async () => {
        const { data, error } = await supabase
            .from('products')
            .select(
                'id, name, brand, color, notes, stock, min_stock, sale_price, purchase_price, category_id, created_at, updated_at, image_url, image_urls, categories(name)'
            )
            .order('created_at', { ascending: false })
        if (!error && data) setProductos(data as unknown as Producto[])
        else setDashboardError('No se pudo actualizar el inventario.')
    }

    const cargarDatos = async () => {
        setCargando(true)
        setDashboardError(null)
        try { await Promise.all([
            obtenerProductos(),
            refrescarMetricas(),
            fetchPanelBadges()
                .then((b) => setPedidosAbiertos(b.ordersPendingOrConfirmed))
                .catch(() => setDashboardError('No se pudieron actualizar los pedidos pendientes.')),
        ]) } catch {
            setDashboardError('No se pudo actualizar el resumen. Revisá tu conexión.')
        } finally { setCargando(false) }
    }

    useEffect(() => {
        void cargarDatos()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga inicial
    }, [])

    const omitFirstPeriodoEffect = useRef(true)
    useEffect(() => {
        if (omitFirstPeriodoEffect.current) {
            omitFirstPeriodoEffect.current = false
            return
        }
        void refrescarMetricas().catch(() => setDashboardError('No se pudo actualizar el período seleccionado.'))
    }, [periodoIngresos, refrescarMetricas])

    // Calcular estadísticas (crítico = debajo de min_stock O stock ≤ umbral si está en Inventario)
    const umbralStockCritico = typeof window !== 'undefined' ? (() => {
        const s = localStorage.getItem('ilara-umbral-stock-critico')
        if (s === null || s === '') return null
        const n = parseInt(s, 10)
        return Number.isFinite(n) && n >= 0 ? n : null
    })() : null
    const totalProductos = productos.length
    const productosCriticos = productos.filter(
        p => p.stock < p.min_stock || (umbralStockCritico != null && p.stock <= umbralStockCritico)
    )
    const productosStockBajo = productosCriticos.length
    const valorTotalInventario = productos.reduce((sum, p) => sum + (p.sale_price * p.stock), 0)

    const totalIngresos = kpi.sales_total + kpi.incomes_total + kpi.catalog_inflow
    const cantidadVentas = kpi.sales_count
    const totalGastos = kpi.expenses_total

    const etiquetaPeriodo = periodoIngresos === 'total' ? 'Total' : periodoIngresos === '7d' ? '7 días' : '30 días'

    const ultimasVentas = ventasRecientes

    const abrirDetalleVenta = async (venta: Venta) => {
        setDetalleVenta(venta)
        setCargandoDetalleVenta(true)
        setItemsDetalleVenta([])
        try {
            const { data, error } = await supabase
                .from('sale_items')
                .select('product_name, quantity, unit_price, subtotal')
                .eq('sale_id', venta.id)
                .order('id')
            if (!error && data) setItemsDetalleVenta(data as ItemVenta[])
        } catch {
            setItemsDetalleVenta([])
        } finally {
            setCargandoDetalleVenta(false)
        }
    }

    if (cargando) return <TableroSkeleton />

    const hora = new Date().getHours()
    const saludoHora =
        hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'

    if (dashboardError) return (
        <div role="alert" className="rounded-2xl border border-warning-line bg-warning-soft p-6 text-amber-950 dark:bg-amber-950 dark:text-amber-100">
            <h2 className="text-xl font-bold">Resumen sin actualizar</h2>
            <p className="mt-2">{dashboardError} Los importes no están disponibles hasta completar la actualización.</p>
            <button type="button" onClick={() => void cargarDatos()} className="mt-4 rounded-xl border px-4 py-2 font-semibold">Reintentar</button>
        </div>
    )

    return (
        <div className="flex flex-col gap-6 sm:gap-8 pb-6 text-ink">
            {/* Header estilo mock */}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <h2 className="text-2xl sm:text-3xl font-bold text-primary-ink tracking-tight">
                        {saludoHora} ✨
                    </h2>
                    <p className="text-muted text-sm mt-1 font-medium">
                        Resumen de tu negocio · hoy
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-success bg-success-soft px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
                        En vivo
                    </span>
                    <button
                        type="button"
                        onClick={() =>
                            onNavigate ? onNavigate('sales') : router.push('/?tab=sales')
                        }
                        className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full bg-primary hover:bg-primary-hover text-white font-bold text-sm transition-colors"
                    >
                        <Receipt className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
                        Nueva venta
                    </button>
                </div>
            </div>

            {/* KPIs — grilla fluida como mock */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-stretch">
                <div className="col-span-2 lg:row-span-2">
                    <TarjetaEstadistica
                        icono={<DollarSign className="w-5 h-5" />}
                        etiqueta="Ingresos"
                        valor={`$${totalIngresos.toLocaleString()}`}
                        destacada
                        subtitulo={`${cantidadVentas} mostrador · ${kpi.incomes_count} manuales${kpi.catalog_inflow > 0 ? ' · web incluida' : ''}`}
                        trend={true}
                        onActivate={onNavigate ? () => onNavigate({ tab: 'incomes', view: 'historial' }) : undefined}
                        selectorPeriodo={
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation()
                                    setMostrarModalPeriodo(true)
                                }}
                                className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
                                aria-label="Cambiar período de ingresos"
                            >
                                <Settings className="w-4 h-4" />
                            </button>
                        }
                    />
                </div>
                <div>
                    <TarjetaEstadistica
                        icono={<Wallet className="w-5 h-5" />}
                        etiqueta="Gastos"
                        valor={`$${totalGastos.toLocaleString()}`}
                        tone={1}
                        subtitulo="Egresos del período"
                        onActivate={onNavigate ? () => onNavigate('expenses') : undefined}
                    />
                </div>
                <div>
                    <TarjetaEstadistica
                        icono={<Package className="w-5 h-5" />}
                        etiqueta="Productos"
                        valor={totalProductos.toString()}
                        tone={2}
                        subtitulo={productosStockBajo > 0 ? `${productosStockBajo} bajo mínimo` : 'Stock OK'}
                        onActivate={onNavigate ? () => onNavigate('inventory') : undefined}
                    />
                </div>
                <div>
                    <TarjetaEstadistica
                        icono={<AlertTriangle className="w-5 h-5" />}
                        etiqueta="Stock crítico"
                        valor={productosStockBajo.toString()}
                        tone={3}
                        alerta={productosStockBajo > 0}
                        subtitulo={`Inv. $${valorTotalInventario.toLocaleString()}`}
                        onActivate={
                            onNavigate
                                ? () => onNavigate('stock_alerts')
                                : () => setMostrarModalAlertas(true)
                        }
                    />
                </div>
                <div>
                    <TarjetaEstadistica
                        icono={<ClipboardList className="w-5 h-5" />}
                        etiqueta="Pedidos web"
                        valor={`$${kpi.catalog_inflow.toLocaleString()}`}
                        tone={4}
                        subtitulo={
                            pedidosAbiertos > 0
                                ? `${pedidosAbiertos} abiertos · cobrados en el período`
                                : 'Cobrados en el período'
                        }
                        alerta={pedidosAbiertos > 0}
                        onActivate={onNavigate ? () => onNavigate('orders') : undefined}
                    />
                </div>
            </div>

            {/* Atajos */}
            {onNavigate && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                    <button
                        type="button"
                        onClick={() => onNavigate('orders')}
                        className="flex items-center gap-3 p-3.5 rounded-full border border-line bg-surface hover:border-primary hover:-translate-y-0.5 transition-all text-left"
                    >
                        <span className="w-10 h-10 rounded-full bg-tint-4 text-primary-ink flex items-center justify-center shrink-0">
                            <ClipboardList className="w-5 h-5" />
                        </span>
                        <span className="min-w-0">
                            <span className="block text-sm font-bold text-ink">Pedidos</span>
                            <span className="block text-xs text-muted font-semibold">Web pendientes</span>
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onNavigate('incomes')}
                        className="flex items-center gap-3 p-3.5 rounded-full border border-line bg-surface hover:border-primary hover:-translate-y-0.5 transition-all text-left"
                    >
                        <span className="w-10 h-10 rounded-full bg-tint-2 text-primary-ink flex items-center justify-center shrink-0">
                            <TrendingUp className="w-5 h-5" />
                        </span>
                        <span className="min-w-0">
                            <span className="block text-sm font-bold text-ink">Ingresos</span>
                            <span className="block text-xs text-muted font-semibold">Ventas e historial</span>
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onNavigate('expenses')}
                        className="flex items-center gap-3 p-3.5 rounded-full border border-line bg-surface hover:border-primary hover:-translate-y-0.5 transition-all text-left"
                    >
                        <span className="w-10 h-10 rounded-full bg-tint-1 text-primary-ink flex items-center justify-center shrink-0">
                            <Wallet className="w-5 h-5" />
                        </span>
                        <span className="min-w-0">
                            <span className="block text-sm font-bold text-ink">Gastos</span>
                            <span className="block text-xs text-muted font-semibold">Egresos del mes</span>
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => router.push('/catalogo')}
                        className="flex items-center gap-3 p-3.5 rounded-full border border-line bg-surface hover:border-primary hover:-translate-y-0.5 transition-all text-left"
                    >
                        <span className="w-10 h-10 rounded-full bg-tint-3 text-primary-ink flex items-center justify-center shrink-0">
                            <Store className="w-5 h-5" />
                        </span>
                        <span className="min-w-0">
                            <span className="block text-sm font-bold text-ink">Catálogo</span>
                            <span className="block text-xs text-muted font-semibold">Vitrina pública</span>
                        </span>
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
                {/* Chart */}
                <div className="lg:col-span-2 flex flex-col min-w-0">
                    <PastelCard noHover className="h-full min-h-[320px] sm:min-h-[360px] flex flex-col p-5 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4 shrink-0">
                            <div className="min-w-0">
                                <h3 className="text-base sm:text-lg font-bold tracking-tight text-ink">
                                    Actividad de ventas
                                </h3>
                                {ventasChartEsMensual ? (
                                    <p className="text-xs text-muted mt-1 leading-relaxed max-w-xl">
                                        Barras mensuales desde la primera venta cobrada (máx. 120 meses).
                                    </p>
                                ) : null}
                            </div>
                            <span className="px-2.5 py-1 rounded-full bg-primary-soft text-[10px] text-primary-ink font-bold uppercase tracking-wider shrink-0 self-start">
                                {etiquetaPeriodo}
                            </span>
                        </div>

                        <TableroVentasChart
                            ventasPorDia={ventasPorDia}
                            theme={theme}
                            valueLabel={ventasChartEsMensual ? 'Ventas (mes)' : 'Ventas'}
                        />
                    </PastelCard>
                </div>

                {/* Recientes */}
                <div className="flex flex-col min-w-0">
                    <PastelCard noHover className="p-5 sm:p-6 h-full">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base sm:text-lg font-bold tracking-tight text-ink">
                                Recientes
                            </h3>
                            <span className="px-2.5 py-1 rounded-full bg-primary-soft text-[10px] text-primary-ink font-bold uppercase tracking-wider">
                                Hoy
                            </span>
                        </div>

                        {ultimasVentas.length > 0 || catalogRecientes.length > 0 ? (
                            <div className="flex flex-col">
                                {[
                                    ...catalogRecientes.map((row) => ({
                                        key: `web-${row.id}`,
                                        title: row.customer_name.trim() || row.order_number,
                                        subtitle: `${row.order_number} · ${paymentMethodLabel((row.method || 'mercado_pago') as PaymentMethodCode)} · web`,
                                        total: row.amount_due,
                                        at: row.approved_at || row.created_at,
                                        onClick: () => onNavigate?.({ tab: 'orders' }),
                                    })),
                                    ...ultimasVentas.map((venta) => {
                                        const fromCustomer = venta.customers
                                            ? `${venta.customers.first_name ?? ''} ${venta.customers.last_name ?? ''}`.trim()
                                            : ''
                                        const nombre = venta.customer_name?.trim() || fromCustomer
                                        return {
                                            key: `pos-${venta.id}`,
                                            title: nombre || `Venta #${venta.id}`,
                                            subtitle: `${venta.payment_method || 'mostrador'} · mostrador`,
                                            total: venta.total,
                                            at: venta.created_at,
                                            onClick: () => abrirDetalleVenta(venta),
                                        }
                                    }),
                                ]
                                    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
                                    .slice(0, 5)
                                    .map((row) => (
                                        <button
                                            key={row.key}
                                            type="button"
                                            onClick={row.onClick}
                                            className="w-full flex items-center gap-3 py-3 border-b border-line last:border-0 text-left group"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-primary-soft flex items-center justify-center text-[11px] font-bold text-primary-ink shrink-0">
                                                {row.title.slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-bold text-sm text-ink group-hover:text-primary transition-colors truncate">
                                                    {row.title}
                                                </p>
                                                <p className="text-xs text-hint font-medium mt-0.5 truncate capitalize">
                                                    {row.subtitle} · {format(new Date(row.at), 'HH:mm', { locale: es })}
                                                </p>
                                            </div>
                                            <p className="font-bold text-sm tabular-nums text-ink shrink-0">
                                                ${row.total.toLocaleString()}
                                            </p>
                                        </button>
                                    ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-muted text-sm border border-dashed border-line rounded-card">
                                <p className="font-medium">Sin ventas recientes</p>
                            </div>
                        )}
                    </PastelCard>
                </div>
            </div>

            {/* Modal detalle venta (Recientes) */}
            {detalleVenta && (
                <ModalDetalleVenta
                    venta={detalleVenta}
                    items={itemsDetalleVenta}
                    cargando={cargandoDetalleVenta}
                    onClose={() => setDetalleVenta(null)}
                />
            )}

            {/* Modal Período ingresos — renderizado en portal para que el backdrop cubra toda la pantalla */}
            {mostrarModalPeriodo && (
                <ModalPeriodoIngresos
                    periodo={periodoIngresos}
                    onSelect={setPeriodoIngresos}
                    onClose={() => setMostrarModalPeriodo(false)}
                />
            )}

            {/* Modal de Alertas — renderizado en portal para que el backdrop cubra toda la pantalla */}
            {mostrarAlertas && (
                <ModalStockCritico productos={productosCriticos} onClose={() => setMostrarModalAlertas(false)} />
            )}
        </div>
    )
}
