'use client'

import { Producto } from '@/lib/supabase'
import Image from 'next/image'
import { X, Edit2, Calendar, Package, DollarSign, Tag, Award } from 'lucide-react'
import { PastelCard } from '@/components/ui/PastelCard'

interface DetalleProductoProps {
    producto: Producto | null
    isOpen: boolean
    onClose: () => void
    onEdit: (producto: Producto) => void
}

export default function DetalleProducto({ producto, isOpen, onClose, onEdit }: DetalleProductoProps) {
    if (!isOpen || !producto) return null

    const margen = producto.purchase_price
        ? Math.round(((producto.sale_price - producto.purchase_price) / producto.sale_price) * 100)
        : null

    const estadoStock =
        producto.stock < producto.min_stock ? 'critico' :
            producto.stock < producto.min_stock * 2 ? 'bajo' : 'ok'

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-[32px] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
                {/* Close Button */}


                <div className="flex flex-col md:flex-row">
                    {/* Image Section */}
                    <div className="w-full md:w-2/5 h-64 md:h-auto relative bg-gray-50 min-h-[300px]">
                        {producto.image_url ? (
                            <Image
                                src={producto.image_url}
                                alt={producto.name}
                                fill
                                className="object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <span className="text-6xl opacity-20 filter grayscale">✨</span>
                            </div>
                        )}

                        {/* Status Badge Over Image */}
                        <div className="absolute bottom-4 left-4">
                            {estadoStock === 'critico' ? (
                                <span className="px-3 py-1.5 rounded-full bg-red-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg">
                                    Stock Crítico
                                </span>
                            ) : estadoStock === 'bajo' ? (
                                <span className="px-3 py-1.5 rounded-full bg-amber-400 text-white text-xs font-bold uppercase tracking-wider shadow-lg">
                                    Stock Bajo
                                </span>
                            ) : (
                                <span className="px-3 py-1.5 rounded-full bg-emerald-400 text-white text-xs font-bold uppercase tracking-wider shadow-lg">
                                    Stock Disponible
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Content Section */}
                    <div className="w-full md:w-3/5 p-8 md:p-12 flex flex-col relative">
                        {/* Close Button Mobile/Desktop */}
                        <button
                            onClick={onClose}
                            className="absolute top-6 right-6 z-10 w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-pink-500 transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Header */}
                        <div className="mb-6 pt-2">
                            <div className="flex items-center gap-2 mb-2">
                                {producto.categories && (
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-pink-500 bg-pink-50 px-2.5 py-1 rounded-full">
                                        {producto.categories.name}
                                    </span>
                                )}
                                {producto.brand && (
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                        {producto.brand}
                                    </span>
                                )}
                            </div>
                            <h2 className="text-2xl font-black text-gray-800 leading-tight mb-2">
                                {producto.name}
                            </h2>
                            {producto.notes && (
                                <p className="text-gray-500 text-sm leading-relaxed">
                                    {producto.notes}
                                </p>
                            )}
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                <p className="text-[10px] font-bold uppercase text-gray-400 mb-1">Precio Venta</p>
                                <p className="text-2xl font-black text-gray-800">${producto.sale_price.toLocaleString()}</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-pink-50 border border-pink-100">
                                <p className="text-[10px] font-bold uppercase text-pink-400 mb-1">Stock Actual</p>
                                <p className="text-2xl font-black text-pink-500">{producto.stock} <span className="text-sm font-medium text-pink-300">unid.</span></p>
                            </div>
                        </div>

                        {/* Detailed Metrics */}
                        <div className="space-y-4 mb-8">
                            <div className="flex items-center justify-between py-3 border-b border-gray-100">
                                <span className="text-sm text-gray-500 flex items-center gap-2">
                                    <Tag className="w-4 h-4" /> Costo Unitario
                                </span>
                                <span className="font-bold text-gray-700">
                                    {producto.purchase_price ? `$${producto.purchase_price.toLocaleString()}` : '-'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-3 border-b border-gray-100">
                                <span className="text-sm text-gray-500 flex items-center gap-2">
                                    <Award className="w-4 h-4" /> Margen de Ganancia
                                </span>
                                <span className={`font-bold ${margen && margen > 30 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                    {margen ? `${margen}%` : '-'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-3 border-b border-gray-100">
                                <span className="text-sm text-gray-500 flex items-center gap-2">
                                    <Package className="w-4 h-4" /> Stock Mínimo
                                </span>
                                <span className="font-bold text-gray-700">{producto.min_stock} u.</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-auto pt-4 border-t border-gray-100">
                            <button
                                onClick={() => {
                                    onClose()
                                    onEdit(producto)
                                }}
                                className="w-full btn-primary flex items-center justify-center gap-2 py-3 rounded-xl shadow-lg shadow-pink-100 hover:shadow-pink-200"
                            >
                                <Edit2 className="w-4 h-4" />
                                <span className="font-bold">Editar Producto</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
