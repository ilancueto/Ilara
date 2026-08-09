'use client'

import { useState } from 'react'
import { Producto, ComboConItems, getProductImages } from '@/lib/supabase'
import { Search, AlertTriangle, Package } from 'lucide-react'
import Image from 'next/image'
import { PastelCard } from '@/components/ui/PastelCard'
import { precioCatalogoProducto } from '@/lib/posPricing'

interface CatalogoPOSProps {
    productos: Producto[]
    combos?: ComboConItems[]
    onAddToCart: (producto: Producto) => void
    onAddCombo?: (combo: ComboConItems) => void
    comboDisponible?: (combo: ComboConItems) => boolean
}

export default function CatalogoPOS({ productos, combos = [], onAddToCart, onAddCombo, comboDisponible }: CatalogoPOSProps) {
    const [terminoBusqueda, setTerminoBusqueda] = useState('')

    const t = terminoBusqueda.toLowerCase().trim()
    const productosFiltrados = productos.filter(p =>
        p.name.toLowerCase().includes(t) || p.brand?.toLowerCase().includes(t)
    ).slice(0, 8)
    const combosFiltrados = (combos || []).filter(c =>
        c.name.toLowerCase().includes(t) || (c.description || '').toLowerCase().includes(t)
    ).slice(0, 4)
    const hayResultados = productosFiltrados.length > 0 || combosFiltrados.length > 0

    return (
        <PastelCard className="h-full flex flex-col min-h-[500px] p-6 dark:bg-gray-800/90 dark:border-gray-700" noHover>
            <div className="relative mb-6">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-pink-400/80 dark:text-pink-500 pointer-events-none" />
                <input
                    type="search"
                    placeholder="Buscar productos por nombre o marca..."
                    value={terminoBusqueda}
                    onChange={(e) => setTerminoBusqueda(e.target.value)}
                    aria-label="Buscar productos por nombre o marca"
                    className="w-full pl-4 pr-12 py-3.5 bg-white dark:bg-gray-700 border border-pink-100 dark:border-gray-600 rounded-2xl focus:border-pink-400 dark:focus:border-pink-500 focus:ring-2 focus:ring-pink-400/20 dark:focus:ring-pink-500/30 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                />
            </div>

            <div className="flex-1 overflow-y-auto min-h-[0] pr-2 custom-scrollbar">
                {terminoBusqueda && hayResultados ? (
                    <div className="space-y-4">
                        {combosFiltrados.map(combo => {
                            const disp = comboDisponible?.(combo) ?? true
                            const img = combo.image_url || (combo.combo_items?.[0]?.products as Producto | undefined)?.image_url
                            return (
                                <button
                                    key={`combo-${combo.id}`}
                                    onClick={() => disp && onAddCombo?.(combo)}
                                    disabled={!disp}
                                    className="w-full text-left p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50 hover:border-amber-200 dark:hover:border-amber-700 transition-all group flex items-center gap-4 disabled:opacity-60 disabled:cursor-not-allowed"
                                    aria-label={`Agregar combo ${combo.name}`}
                                >
                                    <div className="w-12 h-12 rounded-xl bg-white dark:bg-gray-700 flex-shrink-0 overflow-hidden flex items-center justify-center border border-amber-100 dark:border-transparent relative">
                                        {img ? <Image src={img} alt={combo.name} fill className="object-cover" sizes="48px" /> : <Package className="w-6 h-6 text-amber-400 dark:text-amber-500" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">Combo</span>
                                                <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate">{combo.name}</h4>
                                            </div>
                                            <div className="font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-2 py-1 rounded-lg">${combo.sale_price.toLocaleString()}</div>
                                        </div>
                                    </div>
                                </button>
                            )
                        })}
                        {productosFiltrados.map(producto => {
                            const precioMostrar = precioCatalogoProducto(producto)
                            return (
                            <button
                                key={producto.id}
                                onClick={() => {
                                    onAddToCart(producto)
                                    setTerminoBusqueda('')
                                }}
                                className="w-full text-left p-4 rounded-2xl bg-white dark:bg-gray-700/80 border border-pink-100/80 dark:border-gray-600 hover:border-pink-300 dark:hover:border-pink-700 transition-all group flex items-center gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 dark:focus-visible:ring-pink-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
                                aria-label={`Agregar ${producto.name} al carrito, $${precioMostrar.toLocaleString()}`}
                            >
                                <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-gray-600 flex-shrink-0 overflow-hidden flex items-center justify-center border border-gray-100 dark:border-transparent relative">
                                    {getProductImages(producto)[0] ? (
                                        <Image src={getProductImages(producto)[0]} alt={producto.name} fill className="object-cover" sizes="48px" />
                                    ) : (
                                        <span className="text-xs opacity-30">✨</span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-0.5 truncate group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">{producto.name}</h4>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                {producto.brand && <span>{producto.brand}</span>}
                                                <span className={producto.stock < producto.min_stock ? 'text-amber-500 dark:text-amber-400 font-bold flex items-center gap-1' : ''}>
                                                    {producto.stock < producto.min_stock && <AlertTriangle className="w-3 h-3" />}
                                                    Stock: {producto.stock}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right ml-3 flex-shrink-0">
                                            <div className="font-bold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/40 px-2 py-1 rounded-lg">${precioMostrar.toLocaleString()}</div>
                                        </div>
                                    </div>
                                </div>
                            </button>
                            )
                        })}
                    </div>
                ) : terminoBusqueda ? (
                    <div className="flex flex-col items-center justify-center h-40 rounded-2xl bg-pink-50/50 dark:bg-gray-700/50 border border-pink-100/60 dark:border-gray-600">
                        <Search className="w-10 h-10 text-pink-300 dark:text-pink-500 mb-3" strokeWidth={1.5} />
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">No se encontraron productos</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Prueba con otro término</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full pb-10">
                        <div className="w-20 h-20 bg-pink-100/80 dark:bg-pink-900/40 rounded-2xl flex items-center justify-center mb-5">
                            <Search className="w-9 h-9 text-pink-400 dark:text-pink-500" strokeWidth={1.5} />
                        </div>
                        <p className="text-lg font-bold text-gray-800 dark:text-gray-100">Explora tu inventario</p>
                        <p className="text-sm text-center max-w-[220px] mt-2 text-gray-500 dark:text-gray-400">
                            Escribe el nombre o la marca del producto para añadirlo a la venta
                        </p>
                    </div>
                )}
            </div>
        </PastelCard>
    )
}
