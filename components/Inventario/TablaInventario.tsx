'use client'

import { Producto, getProductImages } from '@/lib/supabase'
import { etiquetaBadgeCatalogo } from '@/lib/catalogBadges'
import Image from 'next/image'
import { PastelCard } from '@/components/ui/PastelCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Edit2, Trash2, Package } from 'lucide-react'

interface TablaInventarioProps {
    productos: Producto[]
    loading: boolean
    onEdit: (producto: Producto) => void
    onView: (producto: Producto) => void
    onDelete: (id: number) => void
}

export default function TablaInventario({ productos, loading, onEdit, onView, onDelete }: TablaInventarioProps) {

    const obtenerEstadoStock = (producto: Producto) => {
        if (producto.stock === 0) return 'agotado'
        if (producto.stock < producto.min_stock) return 'critico'
        if (producto.stock < producto.min_stock * 2) return 'bajo'
        return 'ok'
    }

    if (loading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
                {[...Array(8)].map((_, i) => (
                    <PastelCard key={i} className="h-[260px] animate-pulse !p-0" noHover>
                        <div className="h-36 bg-gray-100 dark:bg-gray-800 w-full rounded-t-3xl" />
                        <div className="p-4 space-y-2">
                            <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-3/4 mx-auto" />
                            <div className="h-5 bg-gray-100 dark:bg-gray-800 rounded w-1/2 mx-auto" />
                        </div>
                    </PastelCard>
                ))}
            </div>
        )
    }

    if (productos.length === 0) {
        return (
            <EmptyState
                icon={<Package className="w-12 h-12 text-pink-400" />}
                title="No hay productos"
                description="Creá tu primer producto para armar el inventario."
            />
        )
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6 animate-fade-in pb-20">
            {productos.map(producto => {
                const estadoStock = obtenerEstadoStock(producto)

                return (
                    <div key={producto.id} className="group h-full relative cursor-pointer" onClick={() => onView(producto)}>
                        <PastelCard className="!p-0 flex flex-col h-full overflow-hidden transition-all duration-500 hover:shadow-[0_20px_40px_-5px_rgba(236,72,153,0.15)] hover:-translate-y-2 border-transparent bg-white/80 dark:bg-gray-800/90" noHover>

                            {/* Image: shorter aspect, less empty space */}
                            <div className="relative aspect-[5/3] w-full overflow-hidden bg-gray-50 dark:bg-gray-800 group-hover:bg-white dark:group-hover:bg-gray-700 transition-colors">
                                {getProductImages(producto)[0] ? (
                                    <Image
                                        src={getProductImages(producto)[0]}
                                        alt={producto.name}
                                        fill
                                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <span className="text-4xl opacity-10 dark:opacity-20 filter grayscale group-hover:grayscale-0 transition-all duration-500 group-hover:scale-110">✨</span>
                                    </div>
                                )}

                                {/* Badges: compact group */}
                                <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 justify-end flex-wrap">
                                    {producto.visible_in_catalog === false && (
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-600 text-white text-[10px] font-bold uppercase tracking-wider" title="No se muestra en el catálogo público">
                                            Oculto
                                        </span>
                                    )}
                                    {estadoStock === 'agotado' ? (
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-500 text-white text-[10px] font-bold uppercase tracking-wider">
                                            Agotado
                                        </span>
                                    ) : estadoStock === 'critico' ? (
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider">
                                            Crítico
                                        </span>
                                    ) : estadoStock === 'bajo' ? (
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-amber-400 text-white text-[10px] font-bold uppercase tracking-wider">
                                            Bajo
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-white/90 dark:bg-gray-700 text-gray-500 dark:text-gray-200 text-[10px] font-bold uppercase tracking-wider border border-white/50 dark:border-gray-600">
                                            {producto.stock} u.
                                        </span>
                                    )}
                                </div>

                                {/* Floating actions */}
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 translate-y-8 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300 z-20">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onEdit(producto); }}
                                        className="w-9 h-9 rounded-full bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center justify-center hover:bg-pink-500 hover:text-white dark:hover:bg-pink-600 transition-all duration-300 shadow-lg hover:scale-105 active:scale-95"
                                        title="Ver Detalles / Editar"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete(producto.id); }}
                                        className="w-9 h-9 rounded-full bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center justify-center hover:bg-red-500 hover:text-white dark:hover:bg-red-600 transition-all duration-300 shadow-lg hover:scale-105 active:scale-95"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Body: compact, centered hierarchy */}
                            <div className="px-5 py-4 flex flex-col flex-1 items-center text-center gap-2 min-h-0">
                                {producto.categories && (
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-pink-500 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/40 px-2.5 py-1 rounded-full">
                                        {producto.categories.name}
                                    </span>
                                )}
                                {producto.catalog_badge && (
                                    <span
                                        className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/40 px-2.5 py-1 rounded-full"
                                        title="Badge fijo en el catálogo público"
                                    >
                                        {etiquetaBadgeCatalogo(producto.catalog_badge)}
                                    </span>
                                )}
                                <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 leading-snug group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors line-clamp-2 flex-1">
                                    {producto.name}
                                </h3>
                                <p className="text-lg font-bold text-gray-900 dark:text-gray-100 tracking-tight tabular-nums">
                                    ${producto.sale_price.toLocaleString()}
                                </p>
                            </div>
                        </PastelCard>
                    </div>
                )
            })}
        </div>
    )
}
