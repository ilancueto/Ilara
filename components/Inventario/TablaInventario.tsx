'use client'

import { Producto, getProductImages } from '@/lib/supabase'
import Image from 'next/image'
import { PastelCard } from '@/components/ui/PastelCard'
import { Edit2, Trash2 } from 'lucide-react'

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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {[...Array(8)].map((_, i) => (
                    <PastelCard key={i} className="h-[320px] animate-pulse !p-0" noHover>
                        <div className="h-48 bg-gray-100 w-full mb-4 rounded-t-3xl" />
                        <div className="p-4 space-y-3">
                            <div className="h-6 bg-gray-100 rounded w-3/4" />
                            <div className="h-4 bg-gray-100 rounded w-1/2" />
                        </div>
                    </PastelCard>
                ))}
            </div>
        )
    }

    if (productos.length === 0) {
        return (
            <PastelCard className="text-center py-24 px-5 max-w-lg mx-auto border-dashed border-gray-300 bg-transparent shadow-none" noHover>
                <div className="w-24 h-24 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-4xl">✨</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">No hay productos</h3>
                <p className="text-gray-500">Comienza creando tu primer producto para llenar el inventario.</p>
            </PastelCard>
        )
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 sm:gap-10 animate-fade-in pb-20">
            {productos.map(producto => {
                const estadoStock = obtenerEstadoStock(producto)

                return (
                    <div key={producto.id} className="group h-full relative cursor-pointer" onClick={() => onView(producto)}>
                        <PastelCard className="!p-0 flex flex-col h-full overflow-hidden transition-all duration-500 hover:shadow-[0_20px_40px_-5px_rgba(236,72,153,0.15)] hover:-translate-y-2 border-transparent bg-white/80" noHover>

                            {/* Image Container with Actions */}
                            <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-50 group-hover:bg-white transition-colors">
                                {getProductImages(producto)[0] ? (
                                    <Image
                                        src={getProductImages(producto)[0]}
                                        alt={producto.name}
                                        fill
                                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center relative">
                                        <span className="text-6xl opacity-10 filter grayscale group-hover:grayscale-0 transition-all duration-500 transform group-hover:scale-110">✨</span>
                                    </div>
                                )}

                                {/* Stock Badge - Top Right */}
                                <div className="absolute top-4 right-4 z-10 flex flex-wrap gap-2 justify-end">
                                    {producto.visible_in_catalog === false && (
                                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-600 text-white text-[11px] font-bold uppercase tracking-wider shadow-lg" title="No se muestra en el catálogo público">
                                            Oculto
                                        </span>
                                    )}
                                    {estadoStock === 'agotado' ? (
                                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-500 text-white text-[11px] font-bold uppercase tracking-wider shadow-lg shadow-gray-200">
                                            Agotado
                                        </span>
                                    ) : estadoStock === 'critico' ? (
                                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold uppercase tracking-wider shadow-lg shadow-red-200">
                                            Crítico
                                        </span>
                                    ) : estadoStock === 'bajo' ? (
                                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400 text-white text-[11px] font-bold uppercase tracking-wider shadow-lg shadow-amber-200">
                                            Bajo
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 text-gray-500 text-[11px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md border border-white/50">
                                            {producto.stock} u.
                                        </span>
                                    )}
                                </div>

                                {/* Floating Actions - Bottom Center of Image (Only visible on hover) */}
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 translate-y-10 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300 z-20">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onEdit(producto); }}
                                        className="w-10 h-10 rounded-full bg-white text-gray-700 flex items-center justify-center hover:bg-pink-500 hover:text-white transition-all duration-300 shadow-xl hover:scale-110 active:scale-95"
                                        title="Ver Detalles / Editar"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete(producto.id); }}
                                        className="w-10 h-10 rounded-full bg-white text-gray-700 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all duration-300 shadow-xl hover:scale-110 active:scale-95"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Content Body - Simplified & Centered */}
                            <div className="px-7 py-8 flex flex-col flex-1 items-center text-center relative gap-1">
                                {/* Category Decoration - Simplified */}
                                <div>
                                    {producto.categories && (
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-pink-500 bg-pink-50 px-3 py-1.5 rounded-full">
                                            {producto.categories.name}
                                        </span>
                                    )}
                                </div>

                                <h3 className="text-xl font-bold text-gray-800 leading-snug group-hover:text-pink-600 transition-colors line-clamp-2">
                                    {producto.name}
                                </h3>

                                <div className="mt-auto pt-4">
                                    <span className="text-2xl font-black text-gray-900 tracking-tight">
                                        ${producto.sale_price.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </PastelCard>
                    </div>
                )
            })}
        </div>
    )
}
