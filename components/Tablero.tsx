'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { supabase, Producto, Venta, ItemVenta, getProductImages } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Package, TrendingUp, AlertTriangle, DollarSign, Receipt, Banknote, CreditCard, FileText, ArrowUpRight, Download, Settings, Wallet } from 'lucide-react'
import { format, subDays, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { PastelCard } from '@/components/ui/PastelCard'
import ExportarDatos from '@/components/ExportarDatos'
import { useTheme } from '@/context/ThemeContext'
import { getExpenses } from '@/lib/expenseService'
import type { Expense } from '@/lib/types'

type PeriodoIngresos = 'total' | '7d' | '30d'

export default function Tablero() {
    const router = useRouter()
    const { theme } = useTheme()
    const [productos, setProductos] = useState<Producto[]>([])
    const [ventas, setVentas] = useState<Venta[]>([])
    const [ingresosManuales, setIngresosManuales] = useState<{ amount: number; created_at: string }[]>([])
    const [gastos, setGastos] = useState<Expense[]>([])
    const [periodoIngresos, setPeriodoIngresos] = useState<PeriodoIngresos>('total')
    const [cargando, setCargando] = useState(true)
    const [mostrarAlertas, setMostrarModalAlertas] = useState(false)
    const [mostrarExportar, setMostrarExportar] = useState(false)
    const [mostrarModalPeriodo, setMostrarModalPeriodo] = useState(false)
    const [detalleVenta, setDetalleVenta] = useState<Venta | null>(null)
    const [itemsDetalleVenta, setItemsDetalleVenta] = useState<ItemVenta[]>([])
    const [cargandoDetalleVenta, setCargandoDetalleVenta] = useState(false)

    useEffect(() => {
        cargarDatos()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on mount only
    }, [])

    const cargarDatos = async () => {
        setCargando(true)
        await Promise.all([obtenerProductos(), obtenerVentas(), obtenerIngresosManuales(), obtenerGastos()])
        setCargando(false)
    }

    const obtenerGastos = async () => {
        try {
            const data = await getExpenses()
            setGastos(data || [])
        } catch {
            setGastos([])
        }
    }

    const obtenerIngresosManuales = async () => {
        try {
            const { data, error } = await supabase
                .from('incomes')
                .select('amount, created_at')
            if (!error && data) setIngresosManuales(data)
            else setIngresosManuales([])
        } catch {
            setIngresosManuales([])
        }
    }

    const obtenerProductos = async () => {
        const { data, error } = await supabase
            .from('products')
            .select('*, categories(name)')
            .order('created_at', { ascending: false })
        if (!error && data) setProductos(data)
    }

    const obtenerVentas = async () => {
        const { data, error } = await supabase
            .from('sales')
            .select('*')
            .order('created_at', { ascending: false })
        if (!error && data) setVentas(data)
    }

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

    const corte = periodoIngresos === '7d' ? subDays(new Date(), 7) : periodoIngresos === '30d' ? subDays(new Date(), 30) : null
    const ventasFiltradas = corte ? ventas.filter(v => new Date(v.created_at) >= corte) : ventas
    const ventasCobradas = ventasFiltradas.filter(v => v.status !== 'pending_payment')
    const ingresosFiltrados = corte ? ingresosManuales.filter(i => new Date(i.created_at) >= corte) : ingresosManuales
    const gastosFiltrados = corte ? gastos.filter(g => new Date(g.date) >= corte) : gastos

    const totalVentas = ventasCobradas.reduce((sum, v) => sum + v.total, 0)
    const cantidadVentas = ventasCobradas.length
    const totalIngresosManuales = ingresosFiltrados.reduce((sum, i) => sum + i.amount, 0)
    const totalIngresos = totalVentas + totalIngresosManuales
    const totalGastos = gastosFiltrados.reduce((sum, g) => sum + g.amount, 0)
    const balance = totalIngresos - totalGastos

    const etiquetaPeriodo = periodoIngresos === 'total' ? 'Total' : periodoIngresos === '7d' ? '7 días' : '30 días'

    const diasChart = periodoIngresos === '30d' ? 30 : 7
    const ventasPorDia = []
    for (let i = diasChart - 1; i >= 0; i--) {
        const fecha = subDays(new Date(), i)
        const ventasDelDia = ventasCobradas.filter(v => isSameDay(new Date(v.created_at), fecha))
        const total = ventasDelDia.reduce((sum, v) => sum + v.total, 0)
        ventasPorDia.push({
            fecha: format(fecha, periodoIngresos === '30d' ? 'd MMM' : 'EEE d', { locale: es }),
            total: total,
            cantidad: ventasDelDia.length
        })
    }

    const ultimasVentas = ventasCobradas.slice(0, 5)

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
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-32 bg-gradient-to-br from-pink-50/80 to-white dark:from-gray-800 dark:to-gray-800/80 rounded-3xl border border-pink-100 dark:border-gray-600 animate-pulse" />
                    ))}
                </div>
                <div className="h-80 bg-gradient-to-br from-pink-50/50 to-white dark:from-gray-800 dark:to-gray-800/80 rounded-3xl border border-pink-100 dark:border-gray-600 animate-pulse" />
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
                        subtitulo={`${cantidadVentas} ventas + ${ingresosFiltrados.length} ingresos manuales`}
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
                        <div className="flex items-center justify-between gap-4 mb-5 flex-shrink-0">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                                Actividad de Ventas
                            </h3>
                            <span className="px-3 py-1.5 rounded-full bg-pink-50 dark:bg-pink-900/30 text-[11px] text-pink-600 dark:text-pink-400 font-bold uppercase tracking-wider shrink-0">
                                {etiquetaPeriodo}
                            </span>
                        </div>

                        <div className="flex-1 min-h-[280px] w-full pt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={ventasPorDia} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="barGradientPink" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#f472b6" />
                                            <stop offset="100%" stopColor="#db2777" />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(236,72,153,0.08)'} />
                                    <XAxis
                                        dataKey="fecha"
                                        tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12, fontWeight: 500 }}
                                        axisLine={{ stroke: theme === 'dark' ? '#3f3f46' : '#fce7f3' }}
                                        tickLine={false}
                                        dy={10}
                                    />
                                    <YAxis
                                        tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12, fontWeight: 500 }}
                                        tickFormatter={(value) => value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value}`}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            background: theme === 'dark' ? '#27272a' : '#fff',
                                            border: theme === 'dark' ? '1px solid #3f3f46' : '1px solid #fbcfe8',
                                            borderRadius: '16px',
                                            boxShadow: theme === 'dark' ? '0 10px 30px -5px rgba(0,0,0,0.4)' : '0 10px 30px -5px rgba(236,72,153,0.15)',
                                            padding: '12px 16px',
                                            color: theme === 'dark' ? '#f3f4f6' : '#1f2937'
                                        }}
                                        cursor={{ fill: 'rgba(236, 72, 153, 0.06)' }}
                                        formatter={(value: unknown) => {
                                            const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
                                            return [`$${n.toLocaleString()}`, 'Ventas']
                                        }}
                                    />
                                    <Bar
                                        dataKey="total"
                                        radius={[8, 8, 8, 8]}
                                        fill="url(#barGradientPink)"
                                        barSize={32}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
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
                    <PastelCard noHover className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md max-h-[85vh] overflow-hidden flex flex-col z-[200] !shadow-2xl rounded-3xl border border-gray-200 dark:border-gray-700">
                        {/* Header: sale ID primary, date + payment as metadata */}
                        <div className="p-6 pb-5 border-b border-pink-100 dark:border-gray-700 flex-shrink-0 flex justify-between items-start gap-4">
                            <div className="flex flex-col gap-1.5 min-w-0">
                                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 tracking-tight">Venta #{detalleVenta.id}</h3>
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
                </>,
                document.body
            )}

            {/* Modal Período ingresos — renderizado en portal para que el backdrop cubra toda la pantalla */}
            {mostrarModalPeriodo && typeof document !== 'undefined' && createPortal(
                <>
                    <div className="modal-backdrop" onClick={() => setMostrarModalPeriodo(false)} />
                    <PastelCard noHover className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[340px] z-[200] p-6 !shadow-2xl rounded-3xl border border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
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
                        <div className="pointer-events-auto w-[90vw] max-w-[500px] max-h-[80vh] flex flex-col min-h-0">
                    <PastelCard noHover className="flex flex-col flex-1 min-h-0 overflow-hidden p-6 sm:p-8 !shadow-2xl">
                        <div className="flex justify-between items-center mb-5 flex-shrink-0">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
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
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bgIcon} dark:bg-gray-700 ${color}`}
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
