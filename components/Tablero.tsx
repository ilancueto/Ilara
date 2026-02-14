'use client'

import { useState, useEffect } from 'react'
import { supabase, Producto, Venta } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Package, TrendingUp, AlertTriangle, DollarSign, Receipt, Banknote, CreditCard, FileText, ShoppingBag, ArrowUpRight } from 'lucide-react'
import { format, subDays, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { PastelCard } from '@/components/ui/PastelCard'

type ProductoVendido = {
    product_name: string
    cantidad_vendida: number
    ingresos_totales: number
}

export default function Tablero() {
    const [productos, setProductos] = useState<Producto[]>([])
    const [ventas, setVentas] = useState<Venta[]>([])
    const [topProductos, setTopProductos] = useState<ProductoVendido[]>([])
    const [cargando, setCargando] = useState(true)
    const [mostrarAlertas, setMostrarModalAlertas] = useState(false)

    useEffect(() => {
        cargarDatos()
    }, [])

    const cargarDatos = async () => {
        setCargando(true)
        await Promise.all([obtenerProductos(), obtenerVentas(), obtenerTopProductos()])
        setCargando(false)
    }

    const obtenerProductos = async () => {
        const { data, error } = await supabase
            .from('products')
            .select('*, categories(name)')
            .order('created_at', { ascending: false })
        if (!error && data) setProductos(data)
    }

    const obtenerVentas = async () => {
        // Últimos 7 días
        const hace7Dias = subDays(new Date(), 7)
        const { data, error } = await supabase
            .from('sales')
            .select('*')
            .gte('created_at', hace7Dias.toISOString())
            .order('created_at', { ascending: false })
        if (!error && data) setVentas(data)
    }

    const obtenerTopProductos = async () => {
        // Últimos 30 días
        const hace30Dias = subDays(new Date(), 30)
        const { data, error } = await supabase
            .from('sale_items')
            .select('product_name, quantity, subtotal, created_at')
            .gte('created_at', hace30Dias.toISOString())

        if (!error && data) {
            // Agrupar por producto
            const agrupado = data.reduce((acc: any, item: any) => {
                if (!acc[item.product_name]) {
                    acc[item.product_name] = {
                        product_name: item.product_name,
                        cantidad_vendida: 0,
                        ingresos_totales: 0
                    }
                }
                acc[item.product_name].cantidad_vendida += item.quantity
                acc[item.product_name].ingresos_totales += item.subtotal
                return acc
            }, {})

            // Convertir a array y ordenar
            const sorted = Object.values(agrupado)
                .sort((a: any, b: any) => b.cantidad_vendida - a.cantidad_vendida)
                .slice(0, 5)

            setTopProductos(sorted as ProductoVendido[])
        }
    }

    // Calcular estadísticas
    const totalProductos = productos.length
    const productosCriticos = productos.filter(p => p.stock < p.min_stock)
    const productosStockBajo = productosCriticos.length
    const valorTotalInventario = productos.reduce((sum, p) => sum + (p.sale_price * p.stock), 0)
    const inversionTotal = productos.reduce((sum, p) => sum + ((p.purchase_price || 0) * p.stock), 0)
    const gananciaPotencial = valorTotalInventario - inversionTotal

    // Ventas totales últimos 7 días
    const totalVentas7Dias = ventas.reduce((sum, v) => sum + v.total, 0)
    const cantidadVentas7Dias = ventas.length

    // Agrupar ventas por día
    const ventasPorDia = []
    for (let i = 6; i >= 0; i--) {
        const fecha = subDays(new Date(), i)
        const ventasDelDia = ventas.filter(v => isSameDay(new Date(v.created_at), fecha))
        const total = ventasDelDia.reduce((sum, v) => sum + v.total, 0)

        ventasPorDia.push({
            fecha: format(fecha, 'EEE d', { locale: es }),
            total: total,
            cantidad: ventasDelDia.length
        })
    }

    // Últimas 5 ventas
    const ultimasVentas = ventas.slice(0, 5)

    const obtenerIconoPago = (metodo: string | null) => {
        switch (metodo) {
            case 'efectivo': return <Banknote className="w-4 h-4 text-green-500" />
            case 'tarjeta': return <CreditCard className="w-4 h-4 text-blue-500" />
            case 'transferencia': return <FileText className="w-4 h-4 text-purple-500" />
            default: return <Receipt className="w-4 h-4 text-gray-400" />
        }
    }

    if (cargando) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-32 bg-white/50 rounded-3xl border border-pink-100"></div>
                    ))}
                </div>
                <div className="h-80 bg-white/50 rounded-3xl border border-pink-100"></div>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-12 animate-fade-in pb-12">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 tracking-tight">¡Hola de nuevo! ✨</h2>
                <p className="text-gray-500 text-sm mt-2">Aquí tienes el resumen de hoy.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 lg:gap-10 items-stretch overflow-visible">
                <div className="animate-slide-up stagger-1">
                    <TarjetaEstadistica
                        icono={<DollarSign className="w-6 h-6" />}
                        etiqueta="Ventas (7 días)"
                        valor={`$${totalVentas7Dias.toLocaleString()}`}
                        color="text-pink-500"
                        bgIcon="bg-pink-50"
                        subtitulo={`${cantidadVentas7Dias} operaciones`}
                        trend={true}
                    />
                </div>
                <div className="animate-slide-up stagger-2">
                    <TarjetaEstadistica
                        icono={<Package className="w-6 h-6" />}
                        etiqueta="Total Productos"
                        valor={totalProductos.toString()}
                        color="text-violet-500"
                        bgIcon="bg-violet-50"
                    />
                </div>
                <div className="animate-slide-up stagger-3">
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
                    className={`animate-slide-up stagger-4 ${productosStockBajo > 0 ? 'cursor-pointer' : ''}`}
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
                    <PastelCard className="h-full min-h-[400px] flex flex-col p-9">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                Actividad de Ventas
                            </h3>
                            <div className="flex gap-2">
                                <span className="px-4 py-1.5 rounded-full bg-pink-50 text-[11px] text-pink-600 font-bold uppercase tracking-wider">
                                    Últimos 7 días
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

                    {/* Top Products */}
                    <PastelCard className="p-8">
                        <h3 className="text-lg font-bold mb-6 text-gray-900 flex items-center gap-2">
                            🏆 Top Productos
                        </h3>

                        {topProductos.length > 0 ? (
                            <div className="flex flex-col gap-3">
                                {topProductos.map((prod, idx) => (
                                    <div key={idx} className="flex items-center gap-5 px-5 py-4 rounded-2xl hover:bg-pink-50/50 transition-all group border border-transparent hover:border-pink-100">
                                        <div className={`
                                            w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm
                                            ${idx === 0 ? 'bg-amber-100 text-amber-600' :
                                                idx === 1 ? 'bg-gray-100 text-gray-500' :
                                                    idx === 2 ? 'bg-orange-100 text-orange-600' :
                                                        'bg-white border border-gray-100 text-gray-400'}
                                        `}>
                                            #{idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-gray-800 text-sm truncate group-hover:text-pink-600 transition-colors leading-snug">
                                                {prod.product_name}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 font-medium">
                                                    {prod.cantidad_vendida} un.
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="font-bold text-gray-900 text-sm border-b-2 border-pink-100/50 inline-block tabular-nums">
                                                ${prod.ingresos_totales.toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-gray-300 text-xs border border-dashed border-gray-200 rounded-2xl">
                                <p>Sin datos suficientes</p>
                            </div>
                        )}
                    </PastelCard>

                    {/* Recent Sales */}
                    <PastelCard className="p-8">
                        <h3 className="text-lg font-bold mb-6 text-gray-900 flex items-center gap-2">
                            ⏱️ Recientes
                        </h3>

                        {ultimasVentas.length > 0 ? (
                            <div className="flex flex-col gap-3">
                                {ultimasVentas.slice(0, 4).map(venta => (
                                    <div key={venta.id} className="flex items-center justify-between px-5 py-4 rounded-2xl hover:bg-pink-50/50 transition-all group border border-transparent hover:border-pink-100">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform flex-shrink-0">
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
                                    </div>
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

            {/* Modal de Alertas */}
            {mostrarAlertas && (
                <>
                    <div className="modal-backdrop" onClick={() => setMostrarModalAlertas(false)} />
                    <PastelCard className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[500px] z-[200] max-h-[80vh] flex flex-col p-8 !shadow-2xl">
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

                        <div className="flex flex-col gap-3 overflow-y-auto pr-2 scrollbar-hide">
                            {productosCriticos.map(prod => (
                                <div key={prod.id} className="flex items-center justify-between px-5 py-4 rounded-xl bg-amber-50 border border-amber-100">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-white flex-shrink-0 overflow-hidden flex items-center justify-center relative border border-amber-100">
                                            {prod.image_url ? (
                                                <img src={prod.image_url} alt={prod.name} className="w-full h-full object-cover" />
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
                </>
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
}

function TarjetaEstadistica({ icono, etiqueta, valor, color, bgIcon, subtitulo, alerta, trend }: PropsTarjetaEstadistica) {
    return (
        <PastelCard
            className={`
                px-9 py-9 h-full flex flex-col justify-between group cursor-default min-h-[165px] overflow-visible
                ${alerta ? 'border-2 border-amber-400 shadow-lg shadow-amber-100' : ''}
            `}
        >
            <div className="flex items-start justify-between gap-3 flex-shrink-0">
                <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105 ${bgIcon} ${color}`}
                >
                    {icono}
                </div>
                {alerta && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-600 text-[10px] font-bold uppercase tracking-wider animate-pulse flex-shrink-0">
                        Acción
                    </span>
                )}
                {trend && (
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 flex-shrink-0">
                        <ArrowUpRight className="w-4 h-4" />
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
