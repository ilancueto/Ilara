'use client'

import { useState } from 'react'
import Image from 'next/image'
import { AlertTriangle, Package, Search } from 'lucide-react'
import { Producto, ComboConItems, getProductImages } from '@/lib/supabase'
import { precioListaProducto } from '@/lib/posPricing'

interface CatalogoPOSProps {
    productos: Producto[]
    combos?: ComboConItems[]
    onAddToCart: (producto: Producto) => void
    onAddCombo?: (combo: ComboConItems) => void
    comboDisponible?: (combo: ComboConItems) => boolean
}

export default function CatalogoPOS({ productos, combos = [], onAddToCart, onAddCombo, comboDisponible }: CatalogoPOSProps) {
    const [terminoBusqueda, setTerminoBusqueda] = useState('')
    const termino = terminoBusqueda.toLowerCase().trim()
    const productosFiltrados = productos.filter((producto) =>
        producto.name.toLowerCase().includes(termino) || producto.brand?.toLowerCase().includes(termino)
    )
    const combosFiltrados = combos.filter((combo) =>
        combo.name.toLowerCase().includes(termino) || combo.description?.toLowerCase().includes(termino)
    )
    const hayResultados = productosFiltrados.length > 0 || combosFiltrados.length > 0

    return (
        <div className="min-w-0">
            <div className="relative w-full mb-3">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                <input
                    type="search"
                    placeholder="Buscar producto…"
                    value={terminoBusqueda}
                    onChange={(event) => setTerminoBusqueda(event.target.value)}
                    aria-label="Buscar productos por nombre o marca"
                    className="w-full h-11 pl-10 pr-4 rounded-[14px] border border-pink-100/80 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 outline-none shadow-[0_4px_24px_rgba(190,24,93,0.04)] focus:border-pink-300 focus:ring-2 focus:ring-pink-100 dark:focus:ring-pink-900/30"
                />
            </div>

            <div className="max-h-[min(70dvh,640px)] overflow-y-auto pr-1 custom-scrollbar">
                {hayResultados ? (
                    <div>
                        {combosFiltrados.map((combo) => {
                            const disponible = comboDisponible?.(combo) ?? true
                            const imagen = combo.image_url || (combo.combo_items?.[0]?.products as Producto | undefined)?.image_url
                            return (
                                <button
                                    key={`combo-${combo.id}`}
                                    type="button"
                                    onClick={() => disponible && onAddCombo?.(combo)}
                                    disabled={!disponible}
                                    className="w-full flex items-center gap-3 px-3.5 py-2.5 mb-2 rounded-2xl border border-pink-100/80 dark:border-white/10 bg-white dark:bg-zinc-900 text-left shadow-[0_4px_24px_rgba(190,24,93,0.035)] hover:border-pink-200 disabled:opacity-55 disabled:cursor-not-allowed transition-colors"
                                    aria-label={`Agregar combo ${combo.name}`}
                                >
                                    <span className="relative w-[46px] h-[46px] rounded-xl bg-pink-50 dark:bg-zinc-800 overflow-hidden shrink-0 grid place-items-center">
                                        {imagen ? <Image src={imagen} alt={combo.name} fill className="object-cover" sizes="46px" /> : <Package className="w-5 h-5 text-pink-400" />}
                                    </span>
                                    <span className="flex-1 min-w-0">
                                        <strong className="block text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{combo.name}</strong>
                                        <small className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">Combo{!disponible ? ' · Sin stock' : ''}</small>
                                    </span>
                                    <strong className="text-sm font-extrabold text-gray-900 dark:text-gray-100 tabular-nums whitespace-nowrap shrink-0">${combo.sale_price.toLocaleString()}</strong>
                                </button>
                            )
                        })}

                        {productosFiltrados.map((producto) => {
                            const imagen = getProductImages(producto)[0]
                            const stockBajo = producto.stock < producto.min_stock
                            const precio = precioListaProducto(producto)
                            return (
                                <button
                                    key={producto.id}
                                    type="button"
                                    onClick={() => onAddToCart(producto)}
                                    className="w-full flex items-center gap-3 px-3.5 py-2.5 mb-2 rounded-2xl border border-pink-100/80 dark:border-white/10 bg-white dark:bg-zinc-900 text-left shadow-[0_4px_24px_rgba(190,24,93,0.035)] hover:border-pink-200 transition-colors"
                                    aria-label={`Agregar ${producto.name} al carrito, $${precio.toLocaleString()}`}
                                >
                                    <span className="relative w-[46px] h-[46px] rounded-xl bg-pink-50 dark:bg-zinc-800 overflow-hidden shrink-0 grid place-items-center">
                                        {imagen ? <Image src={imagen} alt={producto.name} fill className="object-cover" sizes="46px" /> : <span className="text-lg" aria-hidden>✨</span>}
                                    </span>
                                    <span className="flex-1 min-w-0">
                                        <strong className="block text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{producto.name}</strong>
                                        <small className={`flex items-center gap-1 text-xs mt-0.5 ${stockBajo ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
                                            {stockBajo && <AlertTriangle className="w-3 h-3" />}
                                            Stock {producto.stock}
                                        </small>
                                    </span>
                                    <strong className="text-sm font-extrabold text-gray-900 dark:text-gray-100 tabular-nums whitespace-nowrap shrink-0">${precio.toLocaleString()}</strong>
                                </button>
                            )
                        })}
                    </div>
                ) : (
                    <div className="py-16 text-center text-gray-500 dark:text-gray-400">
                        <Search className="w-8 h-8 mx-auto mb-3 text-pink-300" />
                        <p className="text-sm font-bold">No encontramos productos</p>
                        <p className="text-xs mt-1">Probá con otro nombre o marca.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
