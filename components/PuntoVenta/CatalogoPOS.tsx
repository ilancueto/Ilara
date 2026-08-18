'use client'

import { useMemo, useState } from 'react'
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

function categoryName(producto: Producto): string {
    return producto.categories?.name?.trim() || 'Sin categoría'
}

function isHexColor(value: string): boolean {
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
}

export default function CatalogoPOS({ productos, combos = [], onAddToCart, onAddCombo, comboDisponible }: CatalogoPOSProps) {
    const [terminoBusqueda, setTerminoBusqueda] = useState('')
    const [categoria, setCategoria] = useState<'all' | 'combos' | string>('all')
    const termino = terminoBusqueda.toLowerCase().trim()

    const categorias = useMemo(() => {
        const counts = new Map<string, number>()
        for (const producto of productos) {
            const name = categoryName(producto)
            counts.set(name, (counts.get(name) || 0) + 1)
        }
        return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'))
    }, [productos])

    const productosFiltrados = productos.filter((producto) => {
        const coincide =
            producto.name.toLowerCase().includes(termino) ||
            (producto.brand?.toLowerCase().includes(termino) ?? false)
        if (!coincide) return false
        if (categoria === 'all' || categoria === 'combos') return categoria === 'all'
        return categoryName(producto) === categoria
    })
    const combosFiltrados = combos.filter((combo) => {
        const coincide =
            combo.name.toLowerCase().includes(termino) ||
            (combo.description?.toLowerCase().includes(termino) ?? false)
        if (!coincide) return false
        return categoria === 'all' || categoria === 'combos'
    })
    const hayResultados = productosFiltrados.length > 0 || combosFiltrados.length > 0

    return (
        <div className="min-w-0 flex flex-col gap-3 h-full">
            <div className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#95909D] pointer-events-none" />
                <input
                    type="search"
                    placeholder="Buscar producto, marca o combo…"
                    value={terminoBusqueda}
                    onChange={(event) => setTerminoBusqueda(event.target.value)}
                    aria-label="Buscar productos por nombre o marca"
                    className="w-full h-11 pl-10 pr-4 rounded-full border border-[#DDD6CE] dark:border-white/10 bg-white dark:bg-zinc-900 text-sm text-[#1A181E] dark:text-gray-100 placeholder:text-[#95909D] outline-none shadow-[0_2px_8px_rgba(26,24,30,0.04)] focus:border-[#D97786] focus:ring-2 focus:ring-[#D97786]/20"
                />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist" aria-label="Categorías">
                <button
                    type="button"
                    role="tab"
                    aria-selected={categoria === 'all'}
                    onClick={() => setCategoria('all')}
                    className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        categoria === 'all'
                            ? 'bg-gradient-to-br from-[#CF6B7F] to-[#B85064] text-white border-transparent shadow-[0_2px_8px_rgba(184,93,111,0.28)]'
                            : 'bg-white dark:bg-zinc-900 border-[#DDD6CE] dark:border-white/10 text-[#635F69]'
                    }`}
                >
                    Todos
                </button>
                {combos.length > 0 && (
                    <button
                        type="button"
                        role="tab"
                        aria-selected={categoria === 'combos'}
                        onClick={() => setCategoria('combos')}
                        className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                            categoria === 'combos'
                                ? 'bg-gradient-to-br from-[#CF6B7F] to-[#B85064] text-white border-transparent shadow-[0_2px_8px_rgba(184,93,111,0.28)]'
                                : 'bg-white dark:bg-zinc-900 border-[#DDD6CE] dark:border-white/10 text-[#635F69]'
                        }`}
                    >
                        Combos
                    </button>
                )}
                {categorias.map(([name, count]) => (
                    <button
                        key={name}
                        type="button"
                        role="tab"
                        aria-selected={categoria === name}
                        onClick={() => setCategoria(name)}
                        className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                            categoria === name
                                ? 'bg-gradient-to-br from-[#CF6B7F] to-[#B85064] text-white border-transparent shadow-[0_2px_8px_rgba(184,93,111,0.28)]'
                                : 'bg-white dark:bg-zinc-900 border-[#DDD6CE] dark:border-white/10 text-[#635F69]'
                        }`}
                    >
                        {name} <span className="opacity-70">{count}</span>
                    </button>
                ))}
            </div>

            <div className="flex-1 min-h-0 max-h-[min(70dvh,720px)] overflow-y-auto pr-1 custom-scrollbar">
                {hayResultados ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {combosFiltrados.map((combo) => {
                            const disponible = comboDisponible?.(combo) ?? true
                            const imagen = combo.image_url || (combo.combo_items?.[0]?.products as Producto | undefined)?.image_url
                            return (
                                <button
                                    key={`combo-${combo.id}`}
                                    type="button"
                                    onClick={() => disponible && onAddCombo?.(combo)}
                                    disabled={!disponible}
                                    className="group flex flex-col overflow-hidden rounded-2xl border border-[#EDE8E1] dark:border-white/10 bg-white dark:bg-zinc-900 text-left shadow-[0_2px_8px_rgba(26,24,30,0.04)] hover:-translate-y-0.5 hover:border-[#D97786] hover:shadow-[0_10px_24px_rgba(184,93,111,0.12)] disabled:opacity-55 disabled:cursor-not-allowed disabled:hover:translate-y-0 transition-all"
                                    aria-label={`Agregar combo ${combo.name}`}
                                >
                                    <span className="relative block h-[118px] bg-[#F3EFEA] dark:bg-zinc-800 overflow-hidden">
                                        {imagen ? (
                                            <Image src={imagen} alt="" fill className="object-cover transition-transform duration-300 group-hover:scale-105" sizes="180px" />
                                        ) : (
                                            <span className="absolute inset-0 grid place-items-center"><Package className="w-7 h-7 text-[#D97786]" /></span>
                                        )}
                                        <span className="absolute top-2 left-2 rounded-full bg-[#C5A880] px-2 py-0.5 text-[10px] font-bold text-[#1A181E]">Combo</span>
                                    </span>
                                    <span className="flex flex-col gap-1 p-3">
                                        <strong className="text-[13px] font-semibold leading-snug text-[#1A181E] dark:text-gray-100 line-clamp-2">{combo.name}</strong>
                                        <span className="flex items-center justify-between gap-2 mt-1">
                                            <strong className="text-sm font-extrabold text-[#C25B6C] tabular-nums">${combo.sale_price.toLocaleString()}</strong>
                                            <small className="text-[11px] text-[#95909D]">{disponible ? 'Listo' : 'Sin stock'}</small>
                                        </span>
                                    </span>
                                </button>
                            )
                        })}

                        {productosFiltrados.map((producto) => {
                            const imagen = getProductImages(producto)[0]
                            const stockBajo = producto.stock < producto.min_stock
                            const precio = precioListaProducto(producto)
                            const tono = producto.color?.trim() || ''
                            return (
                                <button
                                    key={producto.id}
                                    type="button"
                                    onClick={() => onAddToCart(producto)}
                                    className="group flex flex-col overflow-hidden rounded-2xl border border-[#EDE8E1] dark:border-white/10 bg-white dark:bg-zinc-900 text-left shadow-[0_2px_8px_rgba(26,24,30,0.04)] hover:-translate-y-0.5 hover:border-[#D97786] hover:shadow-[0_10px_24px_rgba(184,93,111,0.12)] transition-all"
                                    aria-label={`Agregar ${producto.name} al carrito, $${precio.toLocaleString()}`}
                                >
                                    <span className="relative block h-[118px] bg-[#F3EFEA] dark:bg-zinc-800 overflow-hidden">
                                        {imagen ? (
                                            <Image src={imagen} alt="" fill className="object-cover transition-transform duration-300 group-hover:scale-105" sizes="180px" />
                                        ) : (
                                            <span className="absolute inset-0 grid place-items-center text-2xl" aria-hidden>✨</span>
                                        )}
                                        {stockBajo && (
                                            <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                                <AlertTriangle className="w-3 h-3" /> Bajo
                                            </span>
                                        )}
                                    </span>
                                    <span className="flex flex-col gap-1 p-3">
                                        <strong className="text-[13px] font-semibold leading-snug text-[#1A181E] dark:text-gray-100 line-clamp-2">{producto.name}</strong>
                                        {tono ? (
                                            <small className="inline-flex items-center gap-1.5 text-[11px] text-[#635F69]">
                                                {isHexColor(tono) ? (
                                                    <span className="w-3 h-3 rounded-full border border-black/10" style={{ background: tono }} aria-hidden />
                                                ) : null}
                                                {tono}
                                            </small>
                                        ) : null}
                                        <span className="flex items-center justify-between gap-2 mt-1">
                                            <strong className="text-sm font-extrabold text-[#C25B6C] tabular-nums">${precio.toLocaleString()}</strong>
                                            <small className={`text-[11px] ${stockBajo ? 'text-amber-600 font-semibold' : 'text-[#95909D]'}`}>
                                                Stock {producto.stock}
                                            </small>
                                        </span>
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                ) : (
                    <div className="py-16 text-center text-[#635F69]">
                        <Search className="w-8 h-8 mx-auto mb-3 text-[#D97786]" />
                        <p className="text-sm font-bold text-[#1A181E] dark:text-gray-100">No encontramos productos</p>
                        <p className="text-xs mt-1">Probá con otro nombre, marca o categoría.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
