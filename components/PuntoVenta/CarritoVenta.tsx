'use client'

import { ItemCarrito } from '@/lib/supabase'
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { PastelCard } from '@/components/ui/PastelCard'

interface CarritoVentaProps {
    carrito: ItemCarrito[]
    onUpdateQuantity: (productoId: number, delta: number) => void
    onUpdateQuantityCombo?: (comboId: number, delta: number) => void
    onRemove: (productoId: number) => void
    onRemoveCombo?: (comboId: number) => void
}

export default function CarritoVenta({ carrito, onUpdateQuantity, onUpdateQuantityCombo, onRemove, onRemoveCombo }: CarritoVentaProps) {
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
                    {carrito.map(item => {
                        const esProducto = !!item.producto
                        const nombre = esProducto ? item.producto!.name : item.combo!.name
                        const precio = esProducto ? item.producto!.sale_price : item.combo!.sale_price
                        const imagen = esProducto ? item.producto!.image_url : item.combo!.image_url
                        const key = esProducto ? `p-${item.producto!.id}` : `c-${item.combo!.id}`
                        const maxQty = esProducto ? item.producto!.stock : undefined
                        return (
                            <div key={key} className="flex items-center gap-4 p-3 rounded-2xl bg-pink-50/40 border border-pink-100/80 shadow-sm hover:border-pink-200 hover:shadow-md transition-all group">
                                <div className="w-14 h-14 rounded-xl bg-gray-50 flex-shrink-0 overflow-hidden flex items-center justify-center border border-gray-100 relative">
                                    {imagen ? <Image src={imagen} alt={nombre} fill className="object-cover" /> : <span className="text-sm opacity-30">✨</span>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-gray-800 text-sm mb-1 truncate group-hover:text-pink-600 transition-colors">{nombre}{!esProducto && <span className="text-[9px] font-semibold text-amber-600 bg-amber-100 px-1 rounded ml-1">Combo</span>}</h4>
                                    <p className="text-xs text-gray-500 font-medium">${precio.toLocaleString()} c/u</p>
                                </div>
                                <div className="flex items-center gap-2 bg-white/80 rounded-xl p-1.5 border border-pink-100/60">
                                    <button onClick={() => esProducto ? onUpdateQuantity(item.producto!.id, -1) : onUpdateQuantityCombo?.(item.combo!.id, -1)} disabled={item.cantidad <= 1} className="w-7 h-7 rounded-md bg-white border border-gray-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 hover:text-pink-600 hover:border-pink-200 transition-colors shadow-sm">
                                        <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="w-6 text-center font-bold text-gray-800 text-sm">{item.cantidad}</span>
                                    <button onClick={() => esProducto ? onUpdateQuantity(item.producto!.id, 1) : onUpdateQuantityCombo?.(item.combo!.id, 1)} disabled={maxQty !== undefined && item.cantidad >= maxQty} className="w-7 h-7 rounded-md bg-white border border-gray-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 hover:text-pink-600 hover:border-pink-200 transition-colors shadow-sm">
                                        <Plus className="w-3 h-3" />
                                    </button>
                                </div>
                                <div className="text-right min-w-[70px]">
                                    <p className="font-bold text-gray-800 text-sm">${(precio * item.cantidad).toLocaleString()}</p>
                                </div>
                                <button onClick={() => esProducto ? onRemove(item.producto!.id) : onRemoveCombo?.(item.combo!.id)} className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-red-50 border border-transparent hover:border-red-100 flex items-center justify-center transition-all group/delete">
                                    <Trash2 className="w-4 h-4 text-gray-400 group-hover/delete:text-red-500" />
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
        </PastelCard>
    )
}
