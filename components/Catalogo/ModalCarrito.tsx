'use client'

import Image from 'next/image'
import { Plus, Minus, Trash2, MessageCircle, X, ShoppingBag, Sparkles } from 'lucide-react'
import { PastelCard } from '@/components/ui/PastelCard'
import type { Producto, ItemCarrito } from '@/lib/supabase'

interface ModalCarritoProps {
    open: boolean
    onClose: () => void
    carrito: ItemCarrito[]
    getPrecioConDescuento: (producto: Producto) => number
    quitarDelCarrito: (productoId: number) => void
    actualizarCantidad: (productoId: number, cambio: number) => void
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
    actualizarCantidad,
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
    if (!open) return null

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />

            <PastelCard className="w-full max-w-md max-h-[90vh] flex flex-col z-50 animate-slide-up sm:animate-fade-in-scale shadow-2xl overflow-hidden" noHover>
                <div className="p-6 border-b border-pink-100 flex items-center justify-between bg-white">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Tu pedido</h3>
                        <p className="text-sm text-gray-500 mt-0.5">{carrito.length} {carrito.length === 1 ? 'producto' : 'productos'}</p>
                    </div>
                    <div className="flex gap-2">
                        {carrito.length > 0 && (
                            <button onClick={onSolicitarVaciar} className="p-2.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Vaciar carrito" aria-label="Vaciar carrito">
                                <Trash2 className="w-5 h-5" />
                            </button>
                        )}
                        <button onClick={onClose} className="p-2.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" aria-label="Cerrar carrito">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {carrito.length > 0 ? (
                    <>
                        <div className="flex-1 overflow-y-auto p-6 space-y-5">
                            {carrito.map(item => (
                                <div key={item.producto.id} className="flex gap-4 p-4 rounded-2xl bg-pink-50/50 border border-pink-100/50">
                                    <div className="w-20 h-20 rounded-xl overflow-hidden relative flex-shrink-0 bg-white border border-pink-100">
                                        {item.producto.image_url ? (
                                            <Image src={item.producto.image_url} alt={item.producto.name} fill className="object-cover" />
                                        ) : (
                                            <div className="flex items-center justify-center h-full w-full"><Sparkles className="w-8 h-8 text-pink-200" /></div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start gap-2 mb-2">
                                            <h4 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">{item.producto.name}</h4>
                                            <button onClick={() => quitarDelCarrito(item.producto.id)} className="text-gray-300 hover:text-red-400 p-1 flex-shrink-0" aria-label={`Quitar ${item.producto.name} del carrito`}>
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-500 mb-3">${getPrecioConDescuento(item.producto).toLocaleString()} c/u</p>
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2 bg-white rounded-xl p-1.5 border border-pink-100">
                                                <button onClick={() => actualizarCantidad(item.producto.id, -1)} className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center text-pink-600 hover:bg-pink-100 transition-colors" aria-label="Reducir cantidad">
                                                    <Minus className="w-4 h-4" />
                                                </button>
                                                <span className="text-sm font-bold w-6 text-center">{item.cantidad}</span>
                                                <button onClick={() => actualizarCantidad(item.producto.id, 1)} disabled={item.cantidad >= item.producto.stock} className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center text-pink-600 hover:bg-pink-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Aumentar cantidad">
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <p className="font-extrabold text-gray-900">${(getPrecioConDescuento(item.producto) * item.cantidad).toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-6 bg-gradient-to-br from-pink-50 to-white border-t border-pink-100">
                            {!appliedCoupon ? (
                                <div className="flex gap-2 mb-4">
                                    <input
                                        type="text"
                                        value={cuponInput}
                                        onChange={(e) => setCuponInput(e.target.value)}
                                        placeholder="Ingresar cupón"
                                        className="form-input flex-1 text-sm py-2.5"
                                        aria-label="Código de cupón"
                                    />
                                    <button type="button" onClick={onAplicarCupon} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200 transition-colors">
                                        Aplicar
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between gap-2 mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                                    <span className="text-sm font-bold text-emerald-700">Cupón {appliedCoupon.code} (-{appliedCoupon.discount_percentage}%)</span>
                                    <button type="button" onClick={quitarCupon} className="text-xs font-bold text-emerald-600 hover:text-emerald-800">Quitar</button>
                                </div>
                            )}
                            <div className="space-y-2 mb-5">
                                {appliedCoupon && (
                                    <>
                                        <div className="flex justify-between text-sm text-gray-600">
                                            <span>Subtotal</span>
                                            <span>${subtotal.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-sm text-emerald-600 font-semibold">
                                            <span>Descuento cupón</span>
                                            <span>-${descuentoCupon.toLocaleString()}</span>
                                        </div>
                                    </>
                                )}
                                <div className="flex justify-between items-center pt-2">
                                    <span className="text-gray-600 font-semibold">Total</span>
                                    <span className="text-2xl font-extrabold text-gray-900">${total.toLocaleString()}</span>
                                </div>
                            </div>
                            <button
                                onClick={onWhatsApp}
                                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold shadow-lg shadow-emerald-200/50 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                <MessageCircle className="w-5 h-5" />
                                Pedir por WhatsApp
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                        <div className="w-20 h-20 rounded-full bg-pink-50 flex items-center justify-center mb-6">
                            <ShoppingBag className="w-10 h-10 text-pink-300" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 mb-2">Tu carrito está vacío</h3>
                        <p className="text-gray-500 text-sm mb-6">Explorá el catálogo para agregar productos.</p>
                        <button onClick={onClose} className="px-6 py-3 rounded-xl bg-pink-500 text-white font-bold hover:bg-pink-600 transition-colors">
                            Explorar catálogo
                        </button>
                    </div>
                )}
            </PastelCard>
        </div>
    )
}
