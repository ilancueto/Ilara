'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import { Plus, Minus, Trash2, MessageCircle, X, ShoppingBag, Sparkles } from 'lucide-react'
import { PastelCard } from '@/components/ui/PastelCard'
import type { Producto, ItemCarrito } from '@/lib/supabase'
import { getProductImages } from '@/lib/supabase'

interface ModalCarritoProps {
    open: boolean
    onClose: () => void
    carrito: ItemCarrito[]
    getPrecioConDescuento: (producto: Producto) => number
    quitarDelCarrito: (productoId: number) => void
    quitarComboDelCarrito?: (comboId: number) => void
    actualizarCantidad: (productoId: number, cambio: number) => void
    actualizarCantidadCombo?: (comboId: number, cambio: number) => void
    cuponInput: string
    setCuponInput: (v: string) => void
    appliedCoupon: { code: string; discount_percentage: number } | null
    onAplicarCupon: () => void
    quitarCupon: () => void
    subtotal: number
    descuentoCupon: number
    total: number
    onWhatsApp: () => void
    onSolicitarVaciar: () => void
}

export function ModalCarrito({
    open,
    onClose,
    carrito,
    getPrecioConDescuento,
    quitarDelCarrito,
    quitarComboDelCarrito,
    actualizarCantidad,
    actualizarCantidadCombo,
    cuponInput,
    setCuponInput,
    appliedCoupon,
    onAplicarCupon,
    quitarCupon,
    subtotal,
    descuentoCupon,
    total,
    onWhatsApp,
    onSolicitarVaciar,
}: ModalCarritoProps) {
    const panelRef = useRef<HTMLDivElement>(null)
    useDialogA11y(open, onClose, panelRef)

    if (!open) return null

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />

            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-carrito-titulo"
                className="relative z-10 w-full max-w-md max-h-[90vh] flex flex-col outline-none"
            >
            <PastelCard className="w-full max-w-md max-h-[90vh] flex flex-col z-50 animate-slide-up sm:animate-fade-in-scale shadow-2xl overflow-hidden" noHover>
                <div className="p-6 border-b border-pink-100 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800">
                    <div>
                        <h3 id="modal-carrito-titulo" className="text-xl font-bold text-gray-900 dark:text-gray-100">Tu pedido</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{carrito.length} {carrito.length === 1 ? 'producto' : 'productos'}</p>
                    </div>
                    <div className="flex gap-2">
                        {carrito.length > 0 && (
                            <button onClick={onSolicitarVaciar} className="p-2.5 rounded-xl text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" title="Vaciar carrito" aria-label="Vaciar carrito">
                                <Trash2 className="w-5 h-5" />
                            </button>
                        )}
                        <button onClick={onClose} className="p-2.5 rounded-xl text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" aria-label="Cerrar carrito">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {carrito.length > 0 ? (
                    <>
                        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                            {carrito.map(item => {
                                const esProducto = !!item.producto
                                const nombre = esProducto ? item.producto!.name : item.combo!.name
                                const precioUnit = esProducto ? getPrecioConDescuento(item.producto!) : item.combo!.sale_price
                                const imagen = esProducto ? getProductImages(item.producto!)[0] : item.combo!.image_url
                                const key = esProducto ? `p-${item.producto!.id}` : `c-${item.combo!.id}`
                                const maxStock = esProducto ? item.producto!.stock : undefined
                                return (
                                    <div key={key} className="flex gap-3 p-3.5 rounded-xl bg-pink-50/50 dark:bg-gray-700/60 border border-pink-100/50 dark:border-gray-600">
                                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden relative flex-shrink-0 bg-white dark:bg-gray-600 border border-pink-100 dark:border-gray-500">
                                            {imagen ? (
                                                <Image src={imagen} alt={nombre} fill className="object-cover" />
                                            ) : (
                                                <div className="flex items-center justify-center h-full w-full"><Sparkles className="w-8 h-8 text-pink-200 dark:text-pink-500" /></div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start gap-2 mb-2">
                                                <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-snug line-clamp-2">{nombre}{!esProducto && <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded ml-1">Combo</span>}</h4>
                                                <button onClick={() => esProducto ? quitarDelCarrito(item.producto!.id) : quitarComboDelCarrito?.(item.combo!.id)} className="text-gray-300 dark:text-gray-500 hover:text-red-400 dark:hover:text-red-400 p-1 flex-shrink-0" aria-label={`Quitar ${nombre} del carrito`}>
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">${precioUnit.toLocaleString()} c/u</p>
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-1 bg-white dark:bg-gray-600 rounded-lg p-1 border border-pink-100 dark:border-gray-500">
                                                    <button onClick={() => esProducto ? actualizarCantidad(item.producto!.id, -1) : actualizarCantidadCombo?.(item.combo!.id, -1)} className="w-9 h-9 rounded-md bg-pink-50 dark:bg-gray-500 flex items-center justify-center text-pink-600 dark:text-pink-400 hover:bg-pink-100 dark:hover:bg-gray-400 transition-colors font-bold text-base" aria-label="Reducir cantidad">
                                                        <Minus className="w-4 h-4" />
                                                    </button>
                                                    <span className="text-sm font-bold min-w-[28px] text-center text-gray-900 dark:text-gray-100">{item.cantidad}</span>
                                                    <button onClick={() => esProducto ? actualizarCantidad(item.producto!.id, 1) : actualizarCantidadCombo?.(item.combo!.id, 1)} disabled={maxStock !== undefined && item.cantidad >= maxStock} className="w-9 h-9 rounded-md bg-pink-50 dark:bg-gray-500 flex items-center justify-center text-pink-600 dark:text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-base" aria-label="Aumentar cantidad">
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <p className="font-extrabold text-gray-900 dark:text-gray-100">${(precioUnit * item.cantidad).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="p-5 sm:p-6 bg-gradient-to-br from-pink-50 to-white dark:from-gray-800 dark:to-gray-800/95 border-t border-pink-100 dark:border-gray-700 space-y-4">
                            {!appliedCoupon ? (
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={cuponInput}
                                        onChange={(e) => setCuponInput(e.target.value)}
                                        placeholder="Ingresar cupón"
                                        className="form-input flex-1 text-sm py-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                                        aria-label="Código de cupón"
                                    />
                                    <button type="button" onClick={onAplicarCupon} className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors">
                                        Aplicar
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700">
                                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Cupón {appliedCoupon.code} (-{appliedCoupon.discount_percentage}%)</span>
                                    <button type="button" onClick={quitarCupon} className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200">Quitar</button>
                                </div>
                            )}
                            <div className="space-y-2">
                                {appliedCoupon && (
                                    <>
                                        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                                            <span>Subtotal</span>
                                            <span>${subtotal.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
                                            <span>Descuento cupón</span>
                                            <span>-${descuentoCupon.toLocaleString()}</span>
                                        </div>
                                    </>
                                )}
                                <div className="flex justify-between items-center pt-2 border-t border-gray-200/80 dark:border-gray-600 pt-3">
                                    <span className="text-gray-700 dark:text-gray-200 font-bold">Total</span>
                                    <span className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 tabular-nums">${total.toLocaleString()}</span>
                                </div>
                            </div>
                            <button
                                onClick={onWhatsApp}
                                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-base shadow-xl shadow-emerald-300/50 dark:shadow-emerald-900/40 flex items-center justify-center gap-2 hover:shadow-2xl hover:shadow-emerald-400/50 hover:scale-[1.02] active:scale-[0.98] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
                            >
                                <MessageCircle className="w-5 h-5" />
                                Pedir por WhatsApp
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                        <div className="w-20 h-20 rounded-full bg-pink-50 dark:bg-gray-700 flex items-center justify-center mb-6">
                            <ShoppingBag className="w-10 h-10 text-pink-300 dark:text-pink-500" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Tu carrito está vacío</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 py-2.5">Explorá el catálogo para agregar productos.</p>
                        <button onClick={onClose} className="px-6 py-3 rounded-xl bg-pink-500 dark:bg-pink-600 text-white font-bold hover:bg-pink-600 dark:hover:bg-pink-500 transition-colors m-0">
                            Explorar catálogo
                        </button>
                    </div>
                )}
            </PastelCard>
            </div>
        </div>
    )
}
