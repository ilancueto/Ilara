'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { supabase, Producto, Venta, ItemVenta, getProductImages } from '@/lib/supabase'

const TableroVentasChart = dynamic(() => import('@/components/TableroVentasChart'), {
    ssr: false,
    loading: () => (
        <div
            className="flex-1 min-h-[280px] w-full pt-2 rounded-xl bg-pink-50/40 dark:bg-gray-800/40 animate-pulse"
            aria-hidden
        />
    ),
})
import { Package, TrendingUp, AlertTriangle, DollarSign, Receipt, Banknote, CreditCard, FileText, ArrowUpRight, Download, Settings, Wallet } from 'lucide-react'
import { format, subDays, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { PastelCard } from '@/components/ui/PastelCard'
import ExportarDatos from '@/components/ExportarDatos'
import { useTheme } from '@/context/ThemeContext'
type PeriodoIngresos = 'total' | '7d' | '30d'

type DashboardKpi = {
    sales_total: number
    sales_count: number
    incomes_total: number
    incomes_count: number
    expenses_total: number
}

const KPI_ZERO: DashboardKpi = {
    sales_total: 0,
    sales_count: 0,
    incomes_total: 0,
    incomes_count: 0,
    expenses_total: 0,
}

export default function Tablero() {
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
    const [mostrarAlertas, setMostrarModalAlertas] = useState(false)
    const [mostrarExportar, setMostrarExportar] = useState(false)
    const [mostrarModalPeriodo, setMostrarModalPeriodo] = useState(false)
    const [detalleVenta, setDetalleVenta] = useState<Venta | null>(null)
    const [itemsDetalleVenta, setItemsDetalleVenta] = useState<ItemVenta[]>([])
    const [cargandoDetalleVenta, setCargandoDetalleVenta] = useState(false)

    const refDetalleVenta = useRef<HTMLDivElement>(null)
    const refModalPeriodo = useRef<HTMLDivElement>(null)
    const refModalAlertas = useRef<HTMLDivElement>(null)
    useDialogA11y(!!detalleVenta, () => setDetalleVenta(null), refDetalleVenta)
    useDialogA11y(mostrarModalPeriodo, () => setMostrarModalPeriodo(false), refModalPeriodo)
    useDialogA11y(mostrarAlertas, () => setMostrarModalAlertas(false), refModalAlertas)

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
        }
        if (!kpiErr && kpiRaw && typeof kpiRaw === 'object') {
            const o = kpiRaw as Record<string, unknown>
            setKpi({
                sales_total: Number(o.sales_total ?? 0),
                sales_count: Number(o.sales_count ?? 0),
                incomes_total: Number(o.incomes_total ?? 0),
                incomes_count: Number(o.incomes_count ?? 0),
                expenses_total: Number(o.expenses_total ?? 0),
            })
        }

        if (periodoIngresos === 'total') {
            setVentasChartEsMensual(true)
            const { data: monthlyRaw, error: monthlyErr } = await supabase.rpc('dashboard_sales_monthly_total_span')
            if (monthlyErr) {
                console.warn('[tablero] dashboard_sales_monthly_total_span', monthlyErr.message)
                setVentasPorDia([])
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
                setVentasPorDia([])
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
        if (vErr) setVentasRecientes([])
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
    }

    const cargarDatos = async () => {
        setCargando(true)
        await Promise.all([obtenerProductos(), refrescarMetricas()])
        setCargando(false)
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
        void refrescarMetricas()
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
    const inversionTotal = productos.reduce((sum, p) => sum + ((p.purchase_price || 0) * p.stock), 0)
    const gananciaPotencial = valorTotalInventario - inversionTotal

    const totalIngresos = kpi.sales_total + kpi.incomes_total
    const cantidadVentas = kpi.sales_count
    const totalGastos = kpi.expenses_total
    const balance = totalIngresos - totalGastos

    const etiquetaPeriodo = periodoIngresos === 'total' ? 'Total' : periodoIngresos === '7d' ? '7 días' : '30 días'

    const ultimasVentas = ventasRecientes

    const obtenerIconoPago = (metodo: string | null) => {
        switch (metodo) {
            case 'efectivo': return <Banknote className="w-4 h-4 text-green-500" />
            case 'tarjeta': return <CreditCard className="w-4 h-4 text-blue-500" />
            case 'transferencia': return <FileText className="w-4 h-4 text-purple-500" />
            default: return <Receipt className="w-4 h-4 text-gray-400" />
        }
    }

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

    if (cargando) {
        return (
            <div className="flex flex-col gap-10 pb-12 text-gray-800 dark:text-gray-100">
                {/* Misma jerarquía que el contenido cargado: menos CLS y el h2 puede pintar antes (LCP móvil). */}
                <div className="flex flex-wrap items-center justify-between gap-6">
                    <div className="min-w-0">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 tracking-tight">¡Hola de nuevo! ✨</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1.5">Cargando tu resumen…</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="h-11 w-[9.5rem] rounded-xl bg-pink-100/80 dark:bg-pink-900/40 animate-pulse" aria-hidden />
                        <div className="h-10 w-36 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" aria-hidden />
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5 lg:gap-6 items-stretch">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div
                            key={i}
                            className="h-32 sm:min-h-[8rem] bg-gradient-to-br from-pink-50/80 to-white dark:from-gray-800 dark:to-gray-800/80 rounded-3xl border border-pink-100 dark:border-gray-600 animate-pulse"
                            aria-hidden
                        />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
                    <div className="lg:col-span-2 min-h-[380px] rounded-3xl border border-pink-100 dark:border-gray-600 bg-gradient-to-br from-pink-50/50 to-white dark:from-gray-800 dark:to-gray-800/80 animate-pulse" aria-hidden />
                    <div className="min-h-[280px] rounded-3xl border border-pink-100 dark:border-gray-600 bg-gradient-to-br from-pink-50/40 to-white dark:from-gray-800 dark:to-gray-800/80 animate-pulse" aria-hidden />
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-10 pb-12 text-gray-800 dark:text-gray-100">
            <div className="flex flex-wrap items-center justify-between gap-6">
                <div className="min-w-0">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 tracking-tight">¡Hola de nuevo! ✨</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1.5">Aquí tienes el resumen de hoy.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={() => router.push('/?tab=sales')}
                        className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-sm shadow-xl shadow-pink-300/50 hover:shadow-2xl hover:shadow-pink-400/50 hover:-translate-y-0.5 transition-all ring-2 ring-pink-200/50"
                    >
                        <Receipt className="w-5 h-5" strokeWidth={2.5} />
                        Nueva venta
                    </button>
                    <button
                        type="button"
                        onClick={() => setMostrarExportar(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-pink-200 dark:border-gray-600 bg-pink-50/50 dark:bg-gray-900 dark:text-white text-pink-600 hover:bg-pink-50 dark:hover:bg-gray-800 hover:border-pink-300 dark:hover:border-gray-500 transition-all font-semibold text-sm"
                    >
                        <Download className="w-4 h-4" />
                        Exportar datos
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5 lg:gap-6 items-stretch overflow-visible">
                <div>
                    <TarjetaEstadistica
                        icono={<DollarSign className="w-6 h-6" />}
                        etiqueta="Ingresos"
                        valor={`$${totalIngresos.toLocaleString()}`}
                        color="text-pink-500"
                        bgIcon="bg-pink-50"
                        subtitulo={`${cantidadVentas} ventas + ${kpi.incomes_count} ingresos manuales`}
                        trend={true}
                                selectorPeriodo={
                            <button
                                type="button"
                                onClick={() => setMostrarModalPeriodo(true)}
                                className="p-2 rounded-lg bg-white/80 dark:bg-gray-700 border border-pink-200 dark:border-gray-600 text-pink-600 dark:text-pink-400 hover:bg-white dark:hover:bg-gray-600 hover:border-pink-300 dark:hover:border-pink-600 focus:outline-none focus:ring-2 focus:ring-pink-300 dark:focus:ring-pink-600 transition-colors"
                                aria-label="Cambiar período de ingresos"
                            >
                                <Settings className="w-4 h-4" />
                            </button>
                        }
                    />
                </div>
                <div>
                    <TarjetaEstadistica
                        icono={<Wallet className="w-6 h-6" />}
                        etiqueta="Balance"
                        valor={`$${balance.toLocaleString()}`}
                        color={balance >= 0 ? 'text-emerald-500' : 'text-red-500'}
                        bgIcon={balance >= 0 ? 'bg-emerald-50' : 'bg-red-50'}
                    />
                </div>
                <div>
                    <TarjetaEstadistica
                        icono={<Package className="w-6 h-6" />}
                        etiqueta="Total Productos"
                        valor={totalProductos.toString()}
                        color="text-violet-500"
                        bgIcon="bg-violet-50"
                    />
                </div>
                <div>
                    <TarjetaEstadistica
                        icono={<TrendingUp className="w-6 h-6" />}
                        etiqueta="Valor Inventario"
                        valor={`$${valorTotalInventario.toLocaleString()}`}
                        color="text-blue-500"
                        bgIcon="bg-blue-50"
                        subtitulo={inversionTotal > 0 ? `${Math.round((gananciaPotencial / inversionTotal) * 100)}% rentabilidad` : undefined}
                    />
                </div>
                <div
                    className={productosStockBajo > 0 ? 'cursor-pointer' : ''}
                    onClick={() => productosStockBajo > 0 && setMostrarModalAlertas(true)}
                >
                    <TarjetaEstadistica
                        icono={<AlertTriangle className="w-6 h-6" />}
                        etiqueta="Stock Crítico"
                        valor={productosStockBajo.toString()}
                        color="text-amber-500"
                        bgIcon="bg-amber-50"
                        alerta={productosStockBajo > 0}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">

                {/* Column 1: Sales Chart (Span 2) */}
                <div className="lg:col-span-2 flex flex-col">
                    <PastelCard noHover className="h-full min-h-[380px] flex flex-col p-6 sm:p-7">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5 flex-shrink-0">
                            <div className="min-w-0">
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                                    Actividad de Ventas
                                </h3>
                                {ventasChartEsMensual ? (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed max-w-xl">
                                        Alineado al período Total: barras mensuales desde la primera venta cobrada (máx. 120 meses en pantalla). Las tarjetas de ingresos y balance siguen sumando todo el historial.
                                    </p>
                                ) : null}
                            </div>
                            <span className="px-3 py-1.5 rounded-full bg-pink-50 dark:bg-pink-900/30 text-[11px] text-pink-600 dark:text-pink-400 font-bold uppercase tracking-wider shrink-0 self-start">
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

                {/* Column 2: Side Panel (Span 1) */}
                <div className="flex flex-col">

                    {/* Recent Sales */}
                    <PastelCard noHover className="p-6 sm:p-7 h-full">
                        <h3 className="text-lg font-bold mb-5 text-gray-900 dark:text-gray-100">
                            ⏱️ Recientes
                        </h3>

                        {ultimasVentas.length > 0 ? (
                            <div className="flex flex-col gap-2">
                                {ultimasVentas.slice(0, 4).map(venta => (
                                    <button
                                        key={venta.id}
                                        type="button"
                                        onClick={() => abrirDetalleVenta(venta)}
                                        className="dashboard-recent-item w-full flex items-center justify-between gap-4 px-4 py-3 rounded-xl hover:bg-pink-50/50 dark:hover:bg-gray-700/50 transition-all group border border-transparent hover:border-pink-100 dark:hover:border-gray-600 text-left cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-lg bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 flex items-center justify-center shadow-sm flex-shrink-0">
                                                {obtenerIconoPago(venta.payment_method)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors truncate">#{venta.id}</p>
                                                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mt-0.5">{format(new Date(venta.created_at), "HH:mm", { locale: es })}</p>
                                            </div>
                                        </div>
                                        <p className="font-semibold text-emerald-600 dark:text-emerald-400 text-sm bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-lg shrink-0">
                                            ${venta.total.toLocaleString()}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-xs border border-dashed border-gray-200 dark:border-gray-600 rounded-xl">
                                <p>Sin ventas recientes</p>
                            </div>
                        )}
                    </PastelCard>

                </div>
            </div>

            {/* Modal detalle venta (Recientes) */}
            {detalleVenta && typeof document !== 'undefined' && createPortal(
                <>
                    <div className="modal-backdrop" onClick={() => setDetalleVenta(null)} />
                    <div
                        ref={refDetalleVenta}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="tablero-detalle-venta-titulo"
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md max-h-[85vh] z-[200] outline-none"
                    >
                    <PastelCard noHover className="max-h-[85vh] overflow-hidden flex flex-col !shadow-2xl rounded-3xl border border-gray-200 dark:border-gray-700">
                        {/* Header: sale ID primary, date + payment as metadata */}
                        <div className="p-6 pb-5 border-b border-pink-100 dark:border-gray-700 flex-shrink-0 flex justify-between items-start gap-4">
                            <div className="flex flex-col gap-1.5 min-w-0">
                                <h3 id="tablero-detalle-venta-titulo" className="text-xl font-bold text-gray-800 dark:text-gray-100 tracking-tight">Venta #{detalleVenta.id}</h3>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-gray-500 dark:text-gray-400">
                                    <span>{format(new Date(detalleVenta.created_at), "EEEE d MMM yyyy, HH:mm", { locale: es })}</span>
                                    <span className="flex items-center gap-1.5">
                                        {obtenerIconoPago(detalleVenta.payment_method)}
                                        <span className="font-medium capitalize">{detalleVenta.payment_method || '—'}</span>
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => setDetalleVenta(null)}
                                className="p-2 rounded-xl bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-200 transition-colors flex-shrink-0"
                                aria-label="Cerrar"
                            >
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 min-h-0 flex flex-col gap-6">
                            {/* Client + notes: info block */}
                            {(detalleVenta.customer_name?.trim() || detalleVenta.notes?.trim()) && (
                                <div className="flex flex-col gap-3 p-4 rounded-xl bg-gray-50/80 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
                                    {detalleVenta.customer_name?.trim() && (
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</span>
                                            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{detalleVenta.customer_name}</p>
                                        </div>
                                    )}
                                    {detalleVenta.notes?.trim() && (
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Comentarios</span>
                                            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{detalleVenta.notes}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Product rows */}
                            {cargandoDetalleVenta ? (
                                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">Cargando detalle...</p>
                            ) : itemsDetalleVenta.length > 0 ? (
                                <div className="flex flex-col gap-0">
                                    {itemsDetalleVenta.map((item, idx) => (
                                        <div key={idx} className="venta-detalle-row flex justify-between items-center gap-4 min-h-[52px] py-3 border-b border-gray-100 dark:border-gray-700/80 last:border-0">
                                            <div className="min-w-0 flex flex-col gap-0.5 justify-center">
                                                <p className="font-medium text-gray-800 dark:text-gray-100 text-sm leading-tight truncate">{item.product_name}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{item.quantity} × ${item.unit_price.toLocaleString()}</p>
                                            </div>
                                            <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm tabular-nums shrink-0">${item.subtotal.toLocaleString()}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">Esta venta no tiene ítems registrados.</p>
                            )}
                        </div>

                        {/* Total: clear separation and prominence */}
                        <div className="flex-shrink-0 pt-6 pb-6 px-6 border-t-2 border-gray-200 dark:border-gray-700 bg-pink-50/50 dark:bg-gray-800/50 rounded-b-3xl">
                            <div className="flex justify-between items-center gap-4">
                                <span className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Total</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-2xl tabular-nums">${detalleVenta.total.toLocaleString()}</span>
                            </div>
                        </div>
                    </PastelCard>
                    </div>
                </>,
                document.body
            )}

            {/* Modal Período ingresos — renderizado en portal para que el backdrop cubra toda la pantalla */}
            {mostrarModalPeriodo && typeof document !== 'undefined' && createPortal(
                <>
                    <div className="modal-backdrop" onClick={() => setMostrarModalPeriodo(false)} />
                    <div
                        ref={refModalPeriodo}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="tablero-periodo-titulo"
                        className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[340px] z-[200] outline-none"
                    >
                    <PastelCard noHover className="p-6 !shadow-2xl rounded-3xl border border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-5">
                            <h3 id="tablero-periodo-titulo" className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                <Settings className="w-5 h-5 text-pink-500 dark:text-pink-400" />
                                Período de ingresos
                            </h3>
                            <button
                                onClick={() => setMostrarModalPeriodo(false)}
                                className="p-2 rounded-xl bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                aria-label="Cerrar"
                            >
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            {(['total', '7d', '30d'] as const).map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => { setPeriodoIngresos(p); setMostrarModalPeriodo(false) }}
                                    className={`w-full text-left px-4 py-3 rounded-xl font-semibold text-sm transition-colors ${
                                        periodoIngresos === p
                                            ? 'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 border-2 border-pink-300 dark:border-pink-700'
                                            : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-pink-50 dark:hover:bg-pink-900/20 hover:text-pink-600 dark:hover:text-pink-400 border-2 border-transparent'
                                    }`}
                                >
                                    {p === 'total' ? 'Total' : p === '7d' ? 'Últimos 7 días' : 'Últimos 30 días'}
                                </button>
                            ))}
                        </div>
                    </PastelCard>
                    </div>
                </>,
                document.body
            )}

            {/* Modal Exportar datos */}
            {mostrarExportar && (
                <ExportarDatos mostrar={true} cerrar={() => setMostrarExportar(false)} />
            )}

            {/* Modal de Alertas — renderizado en portal para que el backdrop cubra toda la pantalla */}
            {mostrarAlertas && typeof document !== 'undefined' && createPortal(
                <>
                    <div className="modal-backdrop" onClick={() => setMostrarModalAlertas(false)} />
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 pointer-events-none">
                        <div
                            ref={refModalAlertas}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="tablero-alertas-titulo"
                            className="pointer-events-auto w-[90vw] max-w-[500px] max-h-[80vh] flex flex-col min-h-0 outline-none"
                        >
                    <PastelCard noHover className="flex flex-col flex-1 min-h-0 overflow-hidden p-6 sm:p-8 !shadow-2xl">
                        <div className="flex justify-between items-center mb-5 flex-shrink-0">
                            <h3 id="tablero-alertas-titulo" className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                <AlertTriangle className="w-6 h-6 text-amber-500 dark:text-amber-400" />
                                Stock Crítico
                            </h3>
                            <button
                                onClick={() => setMostrarModalAlertas(false)}
                                className="p-2 rounded-xl bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0 pr-2 scrollbar-hide">
                            {productosCriticos.map(prod => (
                                <div key={prod.id} className="stock-critical-row flex items-center gap-4 min-h-[64px] px-4 py-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-900/20 border border-amber-100/50 dark:border-amber-800/30">
                                    <div className="w-10 h-10 rounded-lg bg-white dark:bg-gray-700 flex-shrink-0 overflow-hidden flex items-center justify-center border border-amber-100/60 dark:border-amber-800/30">
                                        {(getProductImages(prod)[0]) ? (
                                            <Image src={getProductImages(prod)[0]} alt={prod.name} width={40} height={40} className="w-full h-full object-cover" />
                                        ) : (
                                            <AlertTriangle className="w-5 h-5 text-amber-300 dark:text-amber-500" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                                        <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm leading-tight truncate">{prod.name}</p>
                                        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Mín: {prod.min_stock}</p>
                                    </div>
                                    <div className="stock-critical-widget flex-shrink-0 flex flex-col items-center justify-center min-w-[56px] py-1.5 px-2.5 rounded-lg bg-white/90 dark:bg-gray-700/90 border border-amber-100/60 dark:border-gray-600 self-center">
                                        <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-semibold tracking-wider leading-none">Stock</span>
                                        <span className={`font-bold text-sm tabular-nums mt-0.5 leading-none ${prod.stock === 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'}`}>{prod.stock}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex-shrink-0 px-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium text-center">
                                Se recomienda reponer stock lo antes posible
                            </p>
                        </div>
                    </PastelCard>
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    )
}

interface PropsTarjetaEstadistica {
    icono: React.ReactNode
    etiqueta: string
    valor: string
    color: string
    bgIcon: string
    subtitulo?: string
    alerta?: boolean
    trend?: boolean
    selectorPeriodo?: React.ReactNode
}

function TarjetaEstadistica({ icono, etiqueta, valor, color, bgIcon, subtitulo, alerta, trend, selectorPeriodo }: PropsTarjetaEstadistica) {
    return (
        <PastelCard
            noHover
            className={`
                dashboard-metric-card h-full flex flex-col justify-between group cursor-default min-h-[140px] overflow-visible
                ${alerta ? 'border-2 border-amber-400 dark:border-amber-500 shadow-lg shadow-amber-100 dark:shadow-amber-900/30' : ''}
            `}
        >
            <div className="flex items-start justify-between gap-3 flex-shrink-0">
                <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${bgIcon} dark:bg-gray-700 ${color}`}
                >
                    {icono}
                </div>
                {alerta && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider flex-shrink-0">
                        Acción
                    </span>
                )}
                {(trend || selectorPeriodo) && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        {selectorPeriodo}
                        {trend && !selectorPeriodo && (
                            <div className="w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-500 dark:text-emerald-400">
                                <ArrowUpRight className="w-3.5 h-3.5" />
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-1 mt-4 flex-1 min-h-0">
                <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
                    {etiqueta}
                </p>
                <p className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors leading-tight">
                    {valor}
                </p>
                {subtitulo && (
                    <div className="flex items-center gap-2 mt-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-pink-400 dark:bg-pink-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">{subtitulo}</span>
                    </div>
                )}
            </div>
        </PastelCard>
    )
}
