'use client'

import type { ReactNode } from 'react'
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { ItemCarrito } from '@/lib/supabase'
import { precioListaCombo, precioListaProducto } from '@/lib/posPricing'

interface CarritoVentaProps {
    carrito: ItemCarrito[]
    onUpdateQuantity: (productoId: number, delta: number) => void
    onUpdateQuantityCombo?: (comboId: number, delta: number) => void
    onRemove: (productoId: number) => void
    onRemoveCombo?: (comboId: number) => void
    children?: ReactNode
}

export default function CarritoVenta({ carrito, onUpdateQuantity, onUpdateQuantityCombo, onRemove, onRemoveCombo, children }: CarritoVentaProps) {
    const cantidadItems = carrito.reduce((total, item) => total + item.cantidad, 0)

    return (
        <div className="flex flex-col h-full min-h-[320px] rounded-[22px] overflow-hidden border border-[#EDE8E1] dark:border-white/10 bg-white dark:bg-zinc-900 shadow-[0_8px_28px_rgba(26,24,30,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
            <div className="pos-cart-head px-5 py-4 border-b border-[#EDE8E1] dark:border-white/10 bg-[#FAF8F5] dark:bg-zinc-950">
                <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#A98C64]">Ticket</p>
                <h3 className="text-lg font-extrabold text-[#1A181E] dark:text-white leading-tight">Carrito</h3>
                <p className="text-xs text-[#635F69] dark:text-zinc-400 mt-0.5">{cantidadItems === 0 ? 'Sin productos' : `${cantidadItems} ítem${cantidadItems === 1 ? '' : 's'}`}</p>
            </div>

            <div className="flex-1 px-4 py-2.5">
                {carrito.length === 0 ? (
                    <div className="h-full min-h-28 flex flex-col items-center justify-center text-center py-6">
                        <ShoppingCart className="w-7 h-7 text-pink-200 dark:text-pink-700 mb-2" strokeWidth={1.5} />
                        <p className="text-sm font-bold text-gray-700 dark:text-gray-200">El carrito está vacío</p>
                    </div>
                ) : (
                    <div className="max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                        {carrito.map((item) => {
                            const esProducto = Boolean(item.producto)
                            const nombre = esProducto ? item.producto!.name : item.combo!.name
                            const precio = esProducto
                                ? precioListaProducto(item.producto!)
                                : precioListaCombo(item.combo!.sale_price)
                            const key = esProducto ? `p-${item.producto!.id}` : `c-${item.combo!.id}`
                            const maximo = esProducto ? item.producto!.stock : undefined
                            return (
                                <div key={key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 py-2.5 border-b border-pink-100/70 dark:border-white/10 last:border-b-0 text-sm">
                                    <div className="min-w-0">
                                        <strong className="block font-bold text-gray-900 dark:text-gray-100 truncate">{nombre}</strong>
                                        <div className="inline-flex items-center gap-1 mt-1 rounded-lg bg-pink-50 dark:bg-pink-950/30 px-1 py-0.5">
                                            <button type="button" onClick={() => esProducto ? onUpdateQuantity(item.producto!.id, -1) : onUpdateQuantityCombo?.(item.combo!.id, -1)} disabled={item.cantidad <= 1} className="w-5 h-5 grid place-items-center rounded disabled:opacity-35" aria-label={`Reducir ${nombre}`}><Minus className="w-3 h-3" /></button>
                                            <span className="min-w-4 text-center text-xs font-bold tabular-nums">{item.cantidad}</span>
                                            <button type="button" onClick={() => esProducto ? onUpdateQuantity(item.producto!.id, 1) : onUpdateQuantityCombo?.(item.combo!.id, 1)} disabled={maximo !== undefined && item.cantidad >= maximo} className="w-5 h-5 grid place-items-center rounded disabled:opacity-35" aria-label={`Aumentar ${nombre}`}><Plus className="w-3 h-3" /></button>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-1.5 shrink-0">
                                        <strong className="font-extrabold text-gray-900 dark:text-gray-100 tabular-nums whitespace-nowrap">${(precio * item.cantidad).toLocaleString()}</strong>
                                        <button type="button" onClick={() => esProducto ? onRemove(item.producto!.id) : onRemoveCombo?.(item.combo!.id)} className="w-6 h-6 grid place-items-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30" aria-label={`Quitar ${nombre}`}><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
            {children}
        </div>
    )
}
