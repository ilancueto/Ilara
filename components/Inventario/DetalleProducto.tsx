'use client'

import { useState, useEffect } from 'react'
import { Producto, StockMovement, supabase, getProductImages } from '@/lib/supabase'
import Image from 'next/image'
import { X, SquarePen, Package, Tag, Award, History, TrendingDown, TrendingUp, Minus, DollarSign, Eye, EyeOff } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { PastelCard } from '@/components/ui/PastelCard'
import { etiquetaBadgeCatalogo } from '@/lib/catalogBadges'

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="absolute inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
            <PastelCard className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl rounded-3xl border border-line" noHover>
                <div className="flex flex-col md:flex-row flex-1 min-h-0">
                    {/* Imagen */}
                    <div className="relative w-full md:w-72 flex-shrink-0 h-52 md:h-auto md:min-h-[380px] bg-gradient-to-br from-pink-50 to-gray-50 dark:from-gray-800 dark:to-gray-800 rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none overflow-hidden">
                        {getProductImages(producto)[0] ? (
                            <Image
                                src={getProductImages(producto)[0]}
                                alt={producto.name}
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 100vw, 288px"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <span className="text-5xl opacity-30 dark:opacity-40">✨</span>
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

                    {/* Contenido: un solo ritmo con gap, sin márgenes que se pisen */}
                    <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative">
                        <div className="flex-1 min-w-0 overflow-y-auto p-6 sm:p-8 flex flex-col gap-8">
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white dark:bg-gray-700 shadow-sm border border-line flex items-center justify-center text-muted hover:text-accent hover:border-pink-100 dark:hover:border-pink-800 transition-all"
                                aria-label="Cerrar"
                            >
                                <X className="w-4 h-4" />
                            </button>

                            <div className="flex flex-col gap-1">
                                <div className="flex flex-wrap gap-2">
                                    {producto.categories && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-accent bg-primary-soft px-2.5 py-1 rounded-full border border-line">
                                            {producto.categories.name}
                                        </span>
                                    )}
                                    {producto.brand && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted bg-surface-soft px-2.5 py-1 rounded-full">
                                            {producto.brand}
                                        </span>
                                    )}
                                </div>
                                <h2 className="text-xl font-bold text-ink leading-tight pr-12">
                                    {producto.name}
                                </h2>
                                {producto.public_description && (
                                    <p className="text-muted text-sm leading-relaxed whitespace-pre-wrap">
                                        {producto.public_description}
                                    </p>
                                )}
                                {producto.notes && (
                                    <p className="text-muted text-sm leading-relaxed">
                                        <span className="font-medium text-hint">Nota interna · </span>
                                        {producto.notes}
                                    </p>
                                )}
                            </div>

                            {/* Fila de métricas principales: Precio venta + Stock */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col justify-center min-h-[88px] p-4 rounded-2xl bg-gray-50/90 dark:bg-gray-800/80 border border-line">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-hint mb-1.5 flex items-center gap-1.5">
                                        <DollarSign className="w-3.5 h-3.5" /> Precio venta
                                    </p>
                                    <p className="text-xl font-black text-ink">${producto.sale_price.toLocaleString()}</p>
                                </div>
                                <div className="flex flex-col justify-center min-h-[88px] p-4 rounded-2xl bg-gray-50/90 dark:bg-gray-800/80 border border-line">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-hint mb-1.5 flex items-center gap-1.5">
                                        <Package className="w-3.5 h-3.5" /> Stock
                                    </p>
                                    <p className="text-xl font-black text-ink">{producto.stock} <span className="text-sm font-medium text-muted">un.</span></p>
                                </div>
                            </div>

                            {/* Bloque de información secundaria */}
                            <div className="rounded-xl border border-line bg-gray-50/50 dark:bg-gray-800/30 p-3.5">
                                <div className="grid gap-0 divide-y divide-gray-200 dark:divide-gray-600">
                                    <div className="flex items-center justify-between gap-4 py-2.5 first:pt-0">
                                        <span className="text-xs text-muted flex items-center gap-2 shrink-0">
                                            <Tag className="w-3.5 h-3.5 text-hint" /> Costo unitario
                                        </span>
                                        <span className="font-medium text-xs text-ink tabular-nums">
                                            {producto.purchase_price ? `$${producto.purchase_price.toLocaleString()}` : '—'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 py-2.5">
                                        <span className="text-xs text-muted flex items-center gap-2 shrink-0">
                                            <Award className="w-3.5 h-3.5 text-hint" /> Margen
                                        </span>
                                        <span className={`font-medium text-xs tabular-nums ${margen != null && margen > 30 ? 'text-success' : 'text-warning'}`}>
                                            {margen != null ? `${margen}%` : '—'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 py-2.5">
                                        <span className="text-xs text-muted flex items-center gap-2 shrink-0">
                                            <Package className="w-3.5 h-3.5 text-hint" /> Mínimo
                                        </span>
                                        <span className="font-medium text-xs text-ink tabular-nums">{producto.min_stock} un.</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 py-2.5">
                                        <span className="text-xs text-muted flex items-center gap-2 shrink-0">
                                            {producto.visible_in_catalog !== false ? <Eye className="w-3.5 h-3.5 text-hint" /> : <EyeOff className="w-3.5 h-3.5 text-hint" />}
                                            Visible en catálogo
                                        </span>
                                        <span className={`font-medium text-xs ${producto.visible_in_catalog !== false ? 'text-success' : 'text-warning'}`}>
                                            {producto.visible_in_catalog !== false ? 'Sí' : 'No'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 py-2.5 last:pb-0">
                                        <span className="text-xs text-muted flex items-center gap-2 shrink-0">
                                            <Award className="w-3.5 h-3.5 text-hint" /> Badge catálogo
                                        </span>
                                        <span className="font-medium text-xs text-ink text-right">
                                            {etiquetaBadgeCatalogo(producto.catalog_badge)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Ver movimientos — enlace secundario */}
                            <div>
                                <button
                                    type="button"
                                    onClick={() => setMostrarModalMovimientos(true)}
                                    disabled={cargandoMov}
                                    className="inline-flex items-center gap-2 py-2 text-sm font-medium text-muted hover:text-ink disabled:opacity-50 transition-colors"
                                >
                                    <History className="w-4 h-4" />
                                    {cargandoMov ? 'Cargando...' : movimientos.length === 0 ? 'Ver movimientos' : `Ver movimientos (${movimientos.length})`}
                                </button>
                            </div>
                        </div>

                        {/* Pie fijo: CTA Editar */}
                        <div className="flex-shrink-0 p-6 sm:p-8 pt-6 border-t border-line bg-surface/80 backdrop-blur-sm">
                            <button
                                onClick={() => { onClose(); onEdit(producto) }}
                                className="w-full btn-primary flex items-center justify-center gap-2 py-3.5 rounded-full"
                            >
                                <SquarePen size={16} aria-hidden />
                                Editar producto
                            </button>
                        </div>
                    </div>
                </div>
            </PastelCard>

            {/* Modal Movimientos */}
            {mostrarModalMovimientos && (
                <>
                    <div className="fixed inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm z-[60]" onClick={() => setMostrarModalMovimientos(false)} aria-hidden />
                    <div className="fixed inset-0 z-[61] flex items-center justify-center p-4">
                        <PastelCard className="relative w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col shadow-2xl rounded-3xl border border-line" noHover>
                            <div className="px-6 py-5 border-b border-line flex items-center justify-between flex-shrink-0">
                                <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                                    <History className="w-5 h-5 text-accent" />
                                    Movimientos de stock
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setMostrarModalMovimientos(false)}
                                    className="w-9 h-9 rounded-full bg-surface-soft hover:bg-gray-200 dark:hover:bg-gray-600 text-muted hover:text-ink flex items-center justify-center transition-colors"
                                    aria-label="Cerrar"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="p-5 overflow-y-auto flex-1 min-h-0">
                                {movimientos.length === 0 ? (
                                    <p className="text-sm text-muted py-8 text-center">Sin movimientos registrados.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {movimientos.map((m) => {
                                            const esSalida = m.quantity < 0
                                            const label = m.type === 'sale' ? 'Venta' : m.type === 'purchase' ? 'Compra' : 'Ajuste'
                                            const refText = m.reference_type === 'sale' && m.reference_id ? `#${m.reference_id}` : ''
                                            return (
                                                <li
                                                    key={m.id}
                                                    className="flex items-center justify-between gap-3 py-3 px-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-line text-sm"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        {m.type === 'sale' && <TrendingDown className="w-4 h-4 text-danger flex-shrink-0" />}
                                                        {m.type === 'purchase' && <TrendingUp className="w-4 h-4 text-success flex-shrink-0" />}
                                                        {m.type === 'adjustment' && <Minus className="w-4 h-4 text-warning flex-shrink-0" />}
                                                        <div className="min-w-0">
                                                            <span className="font-medium text-ink">{label}</span>
                                                            {refText && <span className="text-hint text-xs ml-1">{refText}</span>}
                                                            <p className="text-xs text-muted mt-0.5">
                                                                {format(new Date(m.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span className={`font-bold tabular-nums flex-shrink-0 ${esSalida ? 'text-danger' : 'text-success'}`}>
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
