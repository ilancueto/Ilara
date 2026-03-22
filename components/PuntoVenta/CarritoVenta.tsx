'use client'

import { ItemCarrito, getProductImages } from '@/lib/supabase'
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { PastelCard } from '@/components/ui/PastelCard'
import { precioListaProducto } from '@/lib/posPricing'

interface CarritoVentaProps {
    carrito: ItemCarrito[]
    onUpdateQuantity: (productoId: number, delta: number) => void
    onUpdateQuantityCombo?: (comboId: number, delta: number) => void
    onRemove: (productoId: number) => void
    onRemoveCombo?: (comboId: number) => void
}

export default function CarritoVenta({ carrito, onUpdateQuantity, onUpdateQuantityCombo, onRemove, onRemoveCombo }: CarritoVentaProps) {
    return (
        <PastelCard className="bg-white/95 dark:bg-gray-800/90 p-6 sm:p-7 border border-gray-100 dark:border-gray-700" noHover>
            <div className="flex items-center gap-4 mb-6 pb-5 border-b border-pink-100/80 dark:border-gray-600">
                <div className="p-3 bg-pink-100 dark:bg-pink-900/40 rounded-xl text-pink-600 dark:text-pink-400 shadow-sm">
                    <ShoppingCart className="w-5 h-5" strokeWidth={2} />
                </div>
                <div>
                    <h3 className="font-bold text-gray-800 dark:text-gray-100">Carrito de compra</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {carrito.length === 0 ? 'Sin productos' : `${carrito.reduce((a, i) => a + i.cantidad, 0)} item(s) agregados`}
                    </p>
                </div>
            </div>

            {carrito.length === 0 ? (
                <div className="flex flex-col items-center text-center py-14 rounded-2xl bg-gradient-to-b from-pink-50/60 dark:from-pink-900/20 to-transparent dark:to-transparent border-2 border-dashed border-pink-200/60 dark:border-gray-600">
                    <div className="w-16 h-16 bg-pink-100/80 dark:bg-pink-900/40 rounded-2xl flex items-center justify-center mb-5">
                        <ShoppingCart className="w-8 h-8 text-pink-400 dark:text-pink-500" strokeWidth={1.5} />
                    </div>
                    <p className="text-gray-700 dark:text-gray-200 font-semibold">El carrito está vacío</p>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Busca productos para agregar a la venta</p>
                </div>
            ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {carrito.map(item => {
                        const esProducto = !!item.producto
                        const nombre = esProducto ? item.producto!.name : item.combo!.name
                        const precio = esProducto ? precioListaProducto(item.producto!) : item.combo!.sale_price
                        const imagen = esProducto ? getProductImages(item.producto!)[0] : item.combo!.image_url
                        const key = esProducto ? `p-${item.producto!.id}` : `c-${item.combo!.id}`
                        const maxQty = esProducto ? item.producto!.stock : undefined
                        return (
                            <div key={key} className="flex items-center gap-4 p-4 rounded-2xl bg-pink-50/40 dark:bg-gray-700/60 border border-pink-100/80 dark:border-gray-600 hover:border-pink-200 dark:hover:border-pink-800 transition-all group">
                                <div className="w-14 h-14 rounded-xl bg-gray-50 dark:bg-gray-600 flex-shrink-0 overflow-hidden flex items-center justify-center border border-gray-100 dark:border-transparent relative">
                                    {imagen ? <Image src={imagen} alt={nombre} fill className="object-cover" /> : <span className="text-sm opacity-30">✨</span>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-1 truncate group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">{nombre}{!esProducto && <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-1 rounded ml-1">Combo</span>}</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">${precio.toLocaleString()} c/u</p>
                                </div>
                                <div className="flex items-center gap-2 bg-white dark:bg-gray-600 rounded-xl p-2 border border-pink-100/60 dark:border-gray-500">
                                    <button onClick={() => esProducto ? onUpdateQuantity(item.producto!.id, -1) : onUpdateQuantityCombo?.(item.combo!.id, -1)} disabled={item.cantidad <= 1} className="w-8 h-8 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-500 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 dark:text-gray-300 hover:text-pink-600 dark:hover:text-pink-400 hover:border-pink-200 dark:hover:border-pink-600 transition-colors">
                                        <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="w-7 text-center font-bold text-gray-800 dark:text-gray-100 text-sm">{item.cantidad}</span>
                                    <button onClick={() => esProducto ? onUpdateQuantity(item.producto!.id, 1) : onUpdateQuantityCombo?.(item.combo!.id, 1)} disabled={maxQty !== undefined && item.cantidad >= maxQty} className="w-8 h-8 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-500 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 dark:text-gray-300 hover:text-pink-600 dark:hover:text-pink-400 hover:border-pink-200 dark:hover:border-pink-600 transition-colors">
                                        <Plus className="w-3 h-3" />
                                    </button>
                                </div>
                                <div className="text-right min-w-[70px]">
                                    <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">${(precio * item.cantidad).toLocaleString()}</p>
                                </div>
                                <button onClick={() => esProducto ? onRemove(item.producto!.id) : onRemoveCombo?.(item.combo!.id)} className="w-9 h-9 rounded-xl bg-gray-50 dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center justify-center transition-colors group/delete">
                                    <Trash2 className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover/delete:text-red-500 dark:group-hover/delete:text-red-400" />
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
        </PastelCard>
    )
}
