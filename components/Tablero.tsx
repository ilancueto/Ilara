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
import { getExpenses } from '@/lib/expenseService'
import type { Expense } from '@/lib/types'

type PeriodoIngresos = 'total' | '7d' | '30d'

export default function Tablero() {
    const router = useRouter()
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
            <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-32 bg-white/50 rounded-3xl border border-pink-100"></div>
                    ))}
                </div>
                <div className="h-80 bg-white/50 rounded-3xl border border-pink-100"></div>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-12 pb-12">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 tracking-tight">¡Hola de nuevo! ✨</h2>
                    <p className="text-gray-500 text-sm mt-2">Aquí tienes el resumen de hoy.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={() => router.push('/?tab=sales')}
                        className="inline-flex items-center gap-3 px-7 py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-base shadow-xl shadow-pink-300/50 hover:shadow-2xl hover:shadow-pink-400/50 hover:-translate-y-0.5 hover:scale-[1.02] transition-all ring-2 ring-pink-200/50"
                    >
                        <Receipt className="w-6 h-6" strokeWidth={2.5} />
                        Nueva venta
                    </button>
                    <button
                        type="button"
                        onClick={() => setMostrarExportar(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-pink-200 bg-pink-50/50 text-pink-600 hover:bg-pink-50 hover:border-pink-300 transition-all font-semibold text-sm"
                    >
                        <Download className="w-4 h-4" />
                        Exportar datos
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 sm:gap-8 lg:gap-10 items-stretch overflow-visible">
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
                                className="p-2 rounded-lg bg-white/80 border border-pink-200 text-pink-600 hover:bg-white hover:border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-300 transition-colors"
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-12">

                {/* Column 1: Sales Chart (Span 2) */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <PastelCard noHover className="h-full min-h-[400px] flex flex-col p-9">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                Actividad de Ventas
                            </h3>
                            <div className="flex gap-2">
                                <span className="px-4 py-1.5 rounded-full bg-pink-50 text-[11px] text-pink-600 font-bold uppercase tracking-wider">
                                    {etiquetaPeriodo}
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={ventasPorDia} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                                    <XAxis
                                        dataKey="fecha"
                                        tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 500 }}
                                        axisLine={{ stroke: '#f3f4f6' }}
                                        tickLine={false}
                                        dy={10}
                                    />
                                    <YAxis
                                        tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 500 }}
                                        tickFormatter={(value) => value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value}`}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            background: '#fff',
                                            border: '1px solid #fbcfe8',
                                            borderRadius: '16px',
                                            boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)',
                                            padding: '12px 16px',
                                            color: '#1f2937'
                                        }}
                                        cursor={{ fill: 'rgba(236, 72, 153, 0.05)' }}
                                    />
                                    <Bar
                                        dataKey="total"
                                        radius={[8, 8, 8, 8]}
                                        fill="#ec4899"
                                        barSize={32}
                                        className="hover:opacity-80 transition-opacity"
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </PastelCard>
                </div>

                {/* Column 2: Side Panel (Span 1) */}
                <div className="flex flex-col gap-8">

                    {/* Recent Sales */}
                    <PastelCard noHover className="p-8">
                        <h3 className="text-lg font-bold mb-6 text-gray-900 flex items-center gap-2">
                            ⏱️ Recientes
                        </h3>

                        {ultimasVentas.length > 0 ? (
                            <div className="flex flex-col gap-3">
                                {ultimasVentas.slice(0, 4).map(venta => (
                                    <button
                                        key={venta.id}
                                        type="button"
                                        onClick={() => abrirDetalleVenta(venta)}
                                        className="w-full flex items-center justify-between px-5 py-4 rounded-2xl hover:bg-pink-50/50 transition-all group border border-transparent hover:border-pink-100 text-left cursor-pointer"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm flex-shrink-0">
                                                {obtenerIconoPago(venta.payment_method)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-800 text-sm group-hover:text-pink-600 transition-colors leading-snug">#{venta.id}</p>
                                                <p className="text-xs text-gray-400 font-medium mt-0.5">{format(new Date(venta.created_at), "HH:mm", { locale: es })}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-emerald-600 text-sm bg-emerald-50 px-2 py-1 rounded-lg">
                                                ${venta.total.toLocaleString()}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-gray-300 text-xs border border-dashed border-gray-200 rounded-2xl">
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
                    <PastelCard noHover className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md max-h-[85vh] overflow-hidden flex flex-col z-[200] !shadow-2xl">
                        <div className="p-6 border-b border-pink-100 flex-shrink-0 flex justify-between items-start gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">Venta #{detalleVenta.id}</h3>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    {format(new Date(detalleVenta.created_at), "EEEE d MMM yyyy, HH:mm", { locale: es })}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                    {obtenerIconoPago(detalleVenta.payment_method)}
                                    <span className="text-xs font-medium text-gray-500 capitalize">
                                        {detalleVenta.payment_method || '—'}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => setDetalleVenta(null)}
                                className="p-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                                aria-label="Cerrar"
                            >
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 min-h-0">
                            {(detalleVenta.customer_name?.trim() || detalleVenta.notes?.trim()) && (
                                <div className="mb-4 p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-2">
                                    {detalleVenta.customer_name?.trim() && (
                                        <p className="text-sm">
                                            <span className="font-semibold text-gray-600">Cliente:</span>{' '}
                                            <span className="text-gray-800">{detalleVenta.customer_name}</span>
                                        </p>
                                    )}
                                    {detalleVenta.notes?.trim() && (
                                        <p className="text-sm">
                                            <span className="font-semibold text-gray-600">Comentarios:</span>{' '}
                                            <span className="text-gray-800">{detalleVenta.notes}</span>
                                        </p>
                                    )}
                                </div>
                            )}
                            {cargandoDetalleVenta ? (
                                <p className="text-sm text-gray-400 text-center py-6">Cargando detalle...</p>
                            ) : itemsDetalleVenta.length > 0 ? (
                                <div className="space-y-3">
                                    {itemsDetalleVenta.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-baseline gap-3 py-2 border-b border-gray-100 last:border-0">
                                            <div className="min-w-0">
                                                <p className="font-medium text-gray-800 text-sm truncate">{item.product_name}</p>
                                                <p className="text-xs text-gray-500">{item.quantity} × ${item.unit_price.toLocaleString()} = ${item.subtotal.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400 text-center py-6">Esta venta no tiene ítems registrados.</p>
                            )}
                        </div>
                        <div className="p-6 border-t border-pink-100 flex-shrink-0 bg-pink-50/50 rounded-b-3xl">
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-gray-800">Total</span>
                                <span className="font-bold text-emerald-600 text-lg">${detalleVenta.total.toLocaleString()}</span>
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
                    <PastelCard noHover className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[340px] z-[200] p-6 !shadow-2xl">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Settings className="w-5 h-5 text-pink-500" />
                                Período de ingresos
                            </h3>
                            <button
                                onClick={() => setMostrarModalPeriodo(false)}
                                className="p-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
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
                                            ? 'bg-pink-100 text-pink-700 border-2 border-pink-300'
                                            : 'bg-gray-50 text-gray-700 hover:bg-pink-50 hover:text-pink-600 border-2 border-transparent'
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
                    <PastelCard noHover className="flex flex-col flex-1 min-h-0 overflow-hidden p-8 !shadow-2xl">
                        <div className="flex justify-between items-center mb-6 flex-shrink-0">
                            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <AlertTriangle className="w-6 h-6 text-amber-500" />
                                Stock Crítico
                            </h3>
                            <button
                                onClick={() => setMostrarModalAlertas(false)}
                                className="p-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="flex flex-col gap-3 overflow-y-auto flex-1 min-h-0 pr-2 scrollbar-hide">
                            {productosCriticos.map(prod => (
                                <div key={prod.id} className="flex items-center justify-between px-5 py-4 rounded-xl bg-amber-50 border border-amber-100">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-white flex-shrink-0 overflow-hidden flex items-center justify-center relative border border-amber-100">
                                            {(getProductImages(prod)[0]) ? (
                                                <Image src={getProductImages(prod)[0]} alt={prod.name} width={40} height={40} className="w-full h-full object-cover" />
                                            ) : (
                                                <AlertTriangle className="w-5 h-5 text-amber-300" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm">{prod.name}</p>
                                            <p className="text-xs text-amber-600 font-medium">Mín: {prod.min_stock}</p>
                                        </div>
                                    </div>
                                    <div className="text-center px-4 py-2 rounded-lg bg-white border border-amber-100 shadow-sm">
                                        <p className="text-[10px] text-amber-500 uppercase font-bold tracking-wider mb-0.5">Stock</p>
                                        <p className={`font-bold text-lg ${prod.stock === 0 ? 'text-red-500' : 'text-gray-800'}`}>{prod.stock}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 pt-4 border-t border-gray-100 text-center flex-shrink-0">
                            <p className="text-xs text-gray-400 font-medium">
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
                px-9 py-9 h-full flex flex-col justify-between group cursor-default min-h-[165px] overflow-visible
                ${alerta ? 'border-2 border-amber-400 shadow-lg shadow-amber-100' : ''}
            `}
        >
            <div className="flex items-start justify-between gap-3 flex-shrink-0">
                <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${bgIcon} ${color}`}
                >
                    {icono}
                </div>
                {alerta && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-600 text-[10px] font-bold uppercase tracking-wider flex-shrink-0">
                        Acción
                    </span>
                )}
                {(trend || selectorPeriodo) && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {selectorPeriodo}
                        {trend && !selectorPeriodo && (
                            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                                <ArrowUpRight className="w-4 h-4" />
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="mt-5 flex-1 min-h-0">
                <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2.5">
                    {etiqueta}
                </p>
                <p className="text-3xl font-extrabold text-gray-900 tracking-tight group-hover:text-pink-600 transition-colors leading-tight pt-0.5 pb-1">
                    {valor}
                </p>
                {subtitulo && (
                    <div className="mt-4 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-pink-400 flex-shrink-0"></div>
                        <span className="text-xs font-medium text-gray-500">{subtitulo}</span>
                    </div>
                )}
            </div>
        </PastelCard>
    )
}
