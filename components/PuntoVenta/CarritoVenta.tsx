'use client'

import { ItemCarrito } from '@/lib/supabase'
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { PastelCard } from '@/components/ui/PastelCard'

interface CarritoVentaProps {
    carrito: ItemCarrito[]
    onUpdateQuantity: (id: number, delta: number) => void
    onRemove: (id: number) => void
}

export default function CarritoVenta({ carrito, onUpdateQuantity, onRemove }: CarritoVentaProps) {
    return (
        <PastelCard className="bg-white/95 p-6" noHover>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-pink-100/80">
                <div className="p-2.5 bg-pink-100 rounded-xl text-pink-600 shadow-sm">
                    <ShoppingCart className="w-5 h-5" strokeWidth={2} />
                </div>
                <div>
                    <h3 className="font-bold text-gray-800">Carrito de compra</h3>
                    <p className="text-xs text-gray-500">
                        {carrito.length === 0 ? 'Sin productos' : `${carrito.reduce((a, i) => a + i.cantidad, 0)} item(s) agregados`}
                    </p>
                </div>
            </div>

            {carrito.length === 0 ? (
                <div className="text-center py-14 rounded-2xl bg-gradient-to-b from-pink-50/60 to-transparent border border-dashed border-pink-200/60">
                    <div className="w-16 h-16 bg-pink-100/80 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                        <ShoppingCart className="w-8 h-8 text-pink-400" strokeWidth={1.5} />
                    </div>
                    <p className="text-gray-700 font-semibold">El carrito está vacío</p>
                    <p className="text-gray-500 text-sm mt-1">Busca productos para agregar a la venta</p>
                </div>
            ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {carrito.map(item => (
                        <div
                            key={item.producto.id}
                            className="flex items-center gap-4 p-3 rounded-2xl bg-pink-50/40 border border-pink-100/80 shadow-sm hover:border-pink-200 hover:shadow-md transition-all group"
                        >
                            {/* Imagen Thumbnail */}
                            <div className="w-14 h-14 rounded-xl bg-gray-50 flex-shrink-0 overflow-hidden flex items-center justify-center border border-gray-100 relative">
                                {item.producto.image_url ? (
                                    <Image
                                        src={item.producto.image_url}
                                        alt={item.producto.name}
                                        fill
                                        className="object-cover"
                                    />
                                ) : (
                                    <span className="text-sm opacity-30">✨</span>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-gray-800 text-sm mb-1 truncate group-hover:text-pink-600 transition-colors">{item.producto.name}</h4>
                                <p className="text-xs text-gray-500 font-medium">${item.producto.sale_price.toLocaleString()} c/u</p>
                            </div>

                            {/* Controles de cantidad */}
                            <div className="flex items-center gap-2 bg-white/80 rounded-xl p-1.5 border border-pink-100/60">
                                <button
                                    onClick={() => onUpdateQuantity(item.producto.id, -1)}
                                    disabled={item.cantidad <= 1}
                                    className="w-7 h-7 rounded-md bg-white border border-gray-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 hover:text-pink-600 hover:border-pink-200 transition-colors shadow-sm"
                                >
                                    <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-6 text-center font-bold text-gray-800 text-sm">{item.cantidad}</span>
                                <button
                                    onClick={() => onUpdateQuantity(item.producto.id, 1)}
                                    disabled={item.cantidad >= item.producto.stock}
                                    className="w-7 h-7 rounded-md bg-white border border-gray-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 hover:text-pink-600 hover:border-pink-200 transition-colors shadow-sm"
                                >
                                    <Plus className="w-3 h-3" />
                                </button>
                            </div>

                            {/* Subtotal */}
                            <div className="text-right min-w-[70px]">
                                <p className="font-bold text-gray-800 text-sm">${(item.producto.sale_price * item.cantidad).toLocaleString()}</p>
                            </div>

                            {/* Eliminar */}
                            <button
                                onClick={() => onRemove(item.producto.id)}
                                className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-red-50 border border-transparent hover:border-red-100 flex items-center justify-center transition-all group/delete"
                            >
                                <Trash2 className="w-4 h-4 text-gray-400 group-hover/delete:text-red-500" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </PastelCard>
    )
}
