'use client'

import { useState, useEffect } from 'react'
import { Producto, StockMovement, supabase } from '@/lib/supabase'
import Image from 'next/image'
import { X, Edit2, Package, Tag, Award, History, TrendingDown, TrendingUp, Minus, DollarSign } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { PastelCard } from '@/components/ui/PastelCard'

interface DetalleProductoProps {
    producto: Producto | null
    isOpen: boolean
    onClose: () => void
    onEdit: (producto: Producto) => void
}

export default function DetalleProducto({ producto, isOpen, onClose, onEdit }: DetalleProductoProps) {
    const [movimientos, setMovimientos] = useState<StockMovement[]>([])
    const [cargandoMov, setCargandoMov] = useState(false)
    const [mostrarModalMovimientos, setMostrarModalMovimientos] = useState(false)

    useEffect(() => {
        if (!isOpen || !producto?.id) return
        setCargandoMov(true)
        void (async () => {
            try {
                const { data } = await supabase
                    .from('stock_movements')
                    .select('*')
                    .eq('product_id', producto.id)
                    .order('created_at', { ascending: false })
                    .limit(20)
                setMovimientos((data as StockMovement[]) || [])
            } finally {
                setCargandoMov(false)
            }
        })()
    }, [isOpen, producto?.id])

    if (!isOpen || !producto) return null

    const margen = producto.purchase_price
        ? Math.round(((producto.sale_price - producto.purchase_price) / producto.sale_price) * 100)
        : null

    const estadoStock =
        producto.stock === 0 ? 'agotado' :
            producto.stock < producto.min_stock ? 'critico' :
                producto.stock < producto.min_stock * 2 ? 'bajo' : 'ok'

    return (
        <div className="fixed inset-0 bg-black/25 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <PastelCard className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" noHover>
                <div className="flex flex-col md:flex-row flex-1 min-h-0">
                    {/* Imagen */}
                    <div className="relative w-full md:w-80 flex-shrink-0 h-56 md:h-auto md:min-h-[420px] bg-gradient-to-br from-pink-50 to-gray-50 rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none overflow-hidden">
                        {producto.image_url ? (
                            <Image
                                src={producto.image_url}
                                alt={producto.name}
                                fill
                                className="object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <span className="text-5xl opacity-30">✨</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent md:from-transparent" />
                        <div className="absolute bottom-3 left-3">
                            {estadoStock === 'agotado' && (
                                <span className="px-2.5 py-1 rounded-full bg-gray-500/95 text-white text-[10px] font-bold uppercase tracking-wider shadow-md">
                                    Agotado
                                </span>
                            )}
                            {estadoStock === 'critico' && (
                                <span className="px-2.5 py-1 rounded-full bg-red-500/95 text-white text-[10px] font-bold uppercase tracking-wider shadow-md">
                                    Stock crítico
                                </span>
                            )}
                            {estadoStock === 'bajo' && (
                                <span className="px-2.5 py-1 rounded-full bg-amber-500/95 text-white text-[10px] font-bold uppercase tracking-wider shadow-md">
                                    Stock bajo
                                </span>
                            )}
                            {estadoStock === 'ok' && (
                                <span className="px-2.5 py-1 rounded-full bg-emerald-500/95 text-white text-[10px] font-bold uppercase tracking-wider shadow-md">
                                    En stock
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0 p-6 md:p-8 flex flex-col overflow-y-auto relative">
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/90 shadow-sm border border-gray-100 flex items-center justify-center text-gray-500 hover:text-pink-500 hover:border-pink-100 transition-all"
                            aria-label="Cerrar"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="flex flex-wrap gap-2 mb-4">
                            {producto.categories && (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-pink-600 bg-pink-50 px-2.5 py-1 rounded-full border border-pink-100">
                                    {producto.categories.name}
                                </span>
                            )}
                            {producto.brand && (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                                    {producto.brand}
                                </span>
                            )}
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 leading-tight mb-1 pr-10">
                            {producto.name}
                        </h2>
                        {producto.notes && (
                            <p className="text-gray-500 text-sm leading-relaxed mb-6">
                                {producto.notes}
                            </p>
                        )}

                        {/* Precio y stock destacados */}
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <div className="p-4 rounded-2xl bg-gray-50/80 border border-gray-100">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 flex items-center gap-1.5">
                                    <DollarSign className="w-3.5 h-3.5" /> Precio venta
                                </p>
                                <p className="text-xl font-black text-gray-800">${producto.sale_price.toLocaleString()}</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-pink-50/80 border border-pink-100">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-pink-500 mb-1 flex items-center gap-1.5">
                                    <Package className="w-3.5 h-3.5" /> Stock
                                </p>
                                <p className="text-xl font-black text-pink-600">{producto.stock} <span className="text-sm font-medium text-pink-400">un.</span></p>
                            </div>
                        </div>

                        {/* Detalle en lista compacta */}
                        <PastelCard className="mt-2.5 p-4 mb-2.5 space-y-3" noHover>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500 flex items-center gap-2">
                                    <Tag className="w-4 h-4 text-gray-400" /> Costo unitario
                                </span>
                                <span className="font-semibold text-gray-800">
                                    {producto.purchase_price ? `$${producto.purchase_price.toLocaleString()}` : '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500 flex items-center gap-2">
                                    <Award className="w-4 h-4 text-gray-400" /> Margen
                                </span>
                                <span className={`font-semibold ${margen != null && margen > 30 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {margen != null ? `${margen}%` : '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500 flex items-center gap-2">
                                    <Package className="w-4 h-4 text-gray-400" /> Mínimo
                                </span>
                                <span className="font-semibold text-gray-800">{producto.min_stock} un.</span>
                            </div>
                        </PastelCard>

                        {/* Botón Ver movimientos */}
                        <div className="mb-6">
                            <button
                                type="button"
                                onClick={() => setMostrarModalMovimientos(true)}
                                disabled={cargandoMov}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-pink-200 bg-pink-50/50 text-pink-600 hover:bg-pink-50 hover:border-pink-300 transition-all font-semibold text-sm disabled:opacity-50 mt-0 mb-0"
                            >
                                <History className="w-4 h-4" />
                                {cargandoMov ? 'Cargando...' : movimientos.length === 0 ? 'Ver movimientos' : `Ver movimientos (${movimientos.length})`}
                            </button>
                        </div>

                        <div className="mt-auto pt-4">
                            <button
                                onClick={() => { onClose(); onEdit(producto) }}
                                className="w-full btn-primary flex items-center justify-center gap-2 py-3 rounded-xl shadow-lg shadow-pink-200/50"
                            >
                                <Edit2 className="w-4 h-4" />
                                Editar producto
                            </button>
                        </div>
                    </div>
                </div>
            </PastelCard>

            {/* Modal Movimientos */}
            {mostrarModalMovimientos && (
                <>
                    <div
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
                        onClick={() => setMostrarModalMovimientos(false)}
                    />
                    <div className="fixed inset-0 z-[61] flex items-center justify-center p-4">
                        <PastelCard className="w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col shadow-2xl" noHover>
                            <div className="p-5 border-b border-pink-100 flex items-center justify-between flex-shrink-0">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <History className="w-5 h-5 text-pink-500" />
                                    Movimientos de stock
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setMostrarModalMovimientos(false)}
                                    className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 flex items-center justify-center transition-colors"
                                    aria-label="Cerrar"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="p-4 overflow-y-auto flex-1 min-h-0">
                                {movimientos.length === 0 ? (
                                    <p className="text-sm text-gray-500 py-8 text-center">Sin movimientos registrados.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {movimientos.map((m) => {
                                            const esSalida = m.quantity < 0
                                            const label = m.type === 'sale' ? 'Venta' : m.type === 'purchase' ? 'Compra' : 'Ajuste'
                                            const refText = m.reference_type === 'sale' && m.reference_id ? `#${m.reference_id}` : ''
                                            return (
                                                <li
                                                    key={m.id}
                                                    className="flex items-center justify-between gap-3 py-3 px-4 rounded-xl bg-gray-50 border border-gray-100 text-sm"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        {m.type === 'sale' && <TrendingDown className="w-4 h-4 text-rose-500 flex-shrink-0" />}
                                                        {m.type === 'purchase' && <TrendingUp className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                                                        {m.type === 'adjustment' && <Minus className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                                                        <div className="min-w-0">
                                                            <span className="font-medium text-gray-800">{label}</span>
                                                            {refText && <span className="text-gray-400 text-xs ml-1">{refText}</span>}
                                                            <p className="text-xs text-gray-500 mt-0.5">
                                                                {format(new Date(m.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span className={`font-bold tabular-nums flex-shrink-0 ${esSalida ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                        {esSalida ? '' : '+'}{m.quantity} u.
                                                    </span>
                                                </li>
                                            )
                                        })}
                                    </ul>
                                )}
                            </div>
                        </PastelCard>
                    </div>
                </>
            )}
        </div>
    )
}
