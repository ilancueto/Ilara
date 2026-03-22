'use client'

import { useState, useEffect, useRef, useCallback, startTransition } from 'react'
import dynamic from 'next/dynamic'
import { Producto, ComboConItems, getProductImages } from '@/lib/supabase'
import { Search, ShoppingBag, Share2, Sparkles, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { WHATSAPP_NUMBER } from '@/lib/config'
import {
    cartSubtotal,
    couponDiscountFromPercent,
    totalAfterCoupon,
} from '@/lib/catalogPricing'
import { getCatalogBadgesForProduct } from '@/lib/catalogBadges'
import { useToast } from '@/context/ToastContext'
import { PastelCard } from '@/components/ui/PastelCard'
import { BadgeRotator } from '@/components/Catalogo/BadgeRotator'
import { ImagenComboRotativa } from '@/components/Catalogo/ImagenComboRotativa'
import { useCarrito } from '@/hooks/useCarrito'
import { useCatalogData } from '@/hooks/useCatalogData'
import { useCatalogDerivedLists } from '@/hooks/useCatalogDerivedLists'
import { ORDEN_DEFAULT, ORDEN_OPTIONS, PRODUCTOS_POR_PAGINA } from '@/components/Catalogo/catalogConstants'
import { validarCuponCatalogo } from '@/app/actions/coupons'
import ThemeSwitch from '@/components/ThemeSwitch'

const ModalCarrito = dynamic(
    () => import('@/components/Catalogo/ModalCarrito').then(m => ({ default: m.ModalCarrito })),
    { ssr: false }
)
const ModalConfirmacionVaciar = dynamic(
    () => import('@/components/Catalogo/ModalConfirmacionVaciar').then(m => ({ default: m.ModalConfirmacionVaciar })),
    { ssr: false }
)
const ModalImagenPrevia = dynamic(
    () => import('@/components/Catalogo/ModalImagenPrevia').then(m => ({ default: m.ModalImagenPrevia })),
    { ssr: false }
)
const ModalDetalleCombo = dynamic(
    () => import('@/components/Catalogo/ModalDetalleCombo').then(m => ({ default: m.ModalDetalleCombo })),
    { ssr: false }
)

export default function Catalogo() {
    const { showToast: baseShowToast } = useToast()
    const [mostrarCarrito, setMostrarCarrito] = useState(false)
    const showToast = useCallback((type: 'success' | 'error' | 'warning' | 'info', message: string) => {
        const action = (type === 'success' && (message.includes('agregado') || message.includes('actualizada')))
            ? { label: 'Ver carrito', onClick: () => setMostrarCarrito(true) }
            : undefined
        baseShowToast(type, message, 4000, action)
    }, [baseShowToast])
    const { carrito, agregarAlCarrito, agregarComboAlCarrito, quitarDelCarrito, quitarComboDelCarrito, actualizarCantidad, actualizarCantidadCombo, clearCarrito, mantenerSoloProductosDisponibles, badgeAnimado } = useCarrito(showToast)
    const [categoriaFiltro, setCategoriaFiltro] = useState<string>('all')
    const [busqueda, setBusqueda] = useState('')
    const [precioMin, setPrecioMin] = useState<number>(0)
    const [precioMax, setPrecioMax] = useState<number>(999999)
    const [ordenamiento, setOrdenamiento] = useState<string>(ORDEN_DEFAULT)
    const {
        productos,
        combos,
        categorias,
        cargando,
        ventasPorProducto,
    } = useCatalogData(ordenamiento)
    const [imagenPrevia, setImagenPrevia] = useState<{ images: string[]; index: number } | null>(null)
    const [indiceImagenPorProducto, setIndiceImagenPorProducto] = useState<Record<number, number>>({})
    const touchSwipeRef = useRef<{ productId: number; x: number; count: number } | null>(null)
    const [comboSeleccionado, setComboSeleccionado] = useState<ComboConItems | null>(null)
    const [mostrarFiltros, setMostrarFiltros] = useState(false)
    const [ordenSelectOpen, setOrdenSelectOpen] = useState(false)
    const ordenSelectRef = useRef<HTMLDivElement>(null)
    const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)
    const [cuponInput, setCuponInput] = useState('')
    const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount_percentage: number } | null>(null)
    const [paginaActual, setPaginaActual] = useState(1)

    // Al salir del catálogo, vaciar el carrito para no arrastrar pedidos viejos
    useEffect(() => {
        return () => { clearCarrito() }
    }, [clearCarrito])

    useEffect(() => {
        if (productos.length > 0 && carrito.length > 0) {
            const combosIds = new Set(combos.map(c => c.id))
            mantenerSoloProductosDisponibles(productos, combosIds)
        }
    }, [productos, combos, carrito.length, mantenerSoloProductosDisponibles])

    const obtenerBadges = (producto: Producto) => getCatalogBadgesForProduct(producto)

    const {
        totalItems,
        totalPaginas,
        itemsPagina,
        comboDisponible,
        getPrecioConDescuento,
    } = useCatalogDerivedLists({
        productos,
        combos,
        ventasPorProducto,
        categoriaFiltro,
        busqueda,
        precioMin,
        precioMax,
        ordenamiento,
        paginaActual,
    })
    const inicio = (paginaActual - 1) * PRODUCTOS_POR_PAGINA

    // Reset página cuando cambian filtros o búsqueda
    /* eslint-disable react-hooks/set-state-in-effect -- reset explícito de índice al cambiar filtros */
    useEffect(() => {
        setPaginaActual(1)
    }, [categoriaFiltro, busqueda, precioMin, precioMax, ordenamiento])
    /* eslint-enable react-hooks/set-state-in-effect */

    // Scroll al top al cambiar de página
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [paginaActual])

    // Cerrar selector de orden al hacer clic fuera
    useEffect(() => {
        if (!ordenSelectOpen) return
        const handleClick = (e: MouseEvent) => {
            if (ordenSelectRef.current && !ordenSelectRef.current.contains(e.target as Node)) {
                setOrdenSelectOpen(false)
            }
        }
        document.addEventListener('click', handleClick)
        return () => document.removeEventListener('click', handleClick)
    }, [ordenSelectOpen])

    const vaciarCarrito = () => {
        clearCarrito()
        setAppliedCoupon(null)
        setMostrarConfirmacion(false)
        setMostrarCarrito(false)
        showToast('info', 'Carrito vaciado')
    }

    const subtotal = cartSubtotal(
        carrito.map(item => ({
            unitPrice: item.producto
                ? getPrecioConDescuento(item.producto)
                : (item.combo?.sale_price ?? 0),
            quantity: item.cantidad,
        }))
    )
    const descuentoCupon = appliedCoupon
        ? couponDiscountFromPercent(subtotal, appliedCoupon.discount_percentage)
        : 0
    const total = totalAfterCoupon(subtotal, descuentoCupon)

    const aplicarCupon = async () => {
        const code = cuponInput.trim().toUpperCase()
        if (!code) {
            showToast('warning', 'Escribí un código')
            return
        }
        const result = await validarCuponCatalogo(code)
        if (!result.ok) {
            showToast('error', 'Cupón inválido o inactivo')
            return
        }
        setAppliedCoupon({ code, discount_percentage: result.discount_percentage })
        setCuponInput('')
        showToast('success', `Cupón ${code} aplicado: -${result.discount_percentage}%`)
    }

    const quitarCupon = () => {
        setAppliedCoupon(null)
    }

    const handleWhatsAppClick = () => {
        if (carrito.length === 0) return
        const items = carrito.map(item => {
            const nombre = item.producto ? item.producto.name : item.combo!.name
            const precioUnit = item.producto ? getPrecioConDescuento(item.producto) : item.combo!.sale_price
            return `• ${nombre} x${item.cantidad} - $${(precioUnit * item.cantidad).toLocaleString()}`
        }).join('%0A')
        let totalLine = `*Total: $${total.toLocaleString()}*`
        if (appliedCoupon) totalLine = `Cupón ${appliedCoupon.code} (-${appliedCoupon.discount_percentage}%)%0A${totalLine}`
        const mensaje = `¡Hola! Me gustaría hacer el siguiente pedido:%0A%0A${items}%0A%0A${totalLine}`
        const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${mensaje}`
        globalThis.window.open(waUrl, '_self', 'noopener,noreferrer')
    }

    const compartirProducto = (producto: Producto) => {
        const precio = getPrecioConDescuento(producto)
        const mensaje = `¡Mirá este producto!%0A%0A*${producto.name}*%0A${producto.brand ? producto.brand + '%0A' : ''}Precio: $${precio.toLocaleString()}%0A%0A¿Te interesa?`
        const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${mensaje}`
        window.open(url, '_blank', 'noopener,noreferrer')
    }

    return (
        <div className="min-h-screen w-full min-w-0 bg-gradient-to-b from-pink-50/30 via-white to-pink-50/20 dark:from-[#08080b] dark:via-[#060609] dark:to-[#08080b]" suppressHydrationWarning>
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#08080b]/80 dark:backdrop-blur-md border-b border-pink-100/40 dark:border-gray-800/30 shadow-sm shadow-pink-500/5 dark:shadow-none">
                <div className="w-full px-4 sm:px-6 lg:px-8 py-2 sm:py-2.5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-white dark:bg-gray-800/60 dark:border-gray-700/60 border border-pink-100 shadow-md shadow-pink-200/40 flex items-center justify-center" aria-hidden>
                                <Image src="/logo_icon.png" alt="" width={40} height={40} className="object-contain w-full h-full" />
                            </div>
                            <div>
                                <h1 className="text-xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">Ilara Beauty</h1>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">Catálogo · Pedí por WhatsApp</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <ThemeSwitch />
                            <Link
                                href="/login"
                                className="px-3 py-2 rounded-xl border border-pink-100 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-semibold text-sm hover:border-pink-200 dark:hover:border-pink-700 hover:text-pink-600 dark:hover:text-pink-400 transition-all duration-200"
                            >
                                Login
                            </Link>
                            <button
                                onClick={() => startTransition(() => setMostrarCarrito(true))}
                                className="relative p-2.5 rounded-xl bg-pink-50 dark:bg-gray-800/60 dark:hover:bg-gray-700/70 hover:bg-pink-100 transition-all duration-200 group focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                                aria-label={carrito.length > 0 ? `Ver carrito, ${carrito.length} producto${carrito.length !== 1 ? 's' : ''}` : 'Ver carrito'}
                            >
                                <ShoppingBag className="w-5 h-5 text-pink-600 dark:text-pink-400 group-hover:scale-110 transition-transform" />
                                {carrito.length > 0 && (
                                    <span className={`absolute -top-0.5 -right-0.5 bg-pink-500 text-white text-xs font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center ${badgeAnimado ? 'animate-bounce' : ''}`}>
                                        {carrito.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Contenedor principal: ancho completo para aprovechar todo el espacio */}
            <div className="w-full px-4 sm:px-6 lg:px-8">
                {/* Hero / bienvenida */}
                <section className="pt-6 pb-8 text-center">
                    <p className="text-pink-600/90 dark:text-pink-400 font-semibold text-[11px] uppercase tracking-widest mb-0.5">Catálogo</p>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">Bienvenidos a Ilara Beauty</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1.5">Elegí lo que te guste y pedilo por WhatsApp</p>
                </section>

                {/* Bloque superior: búsqueda, orden, categorías y filtros integrados */}
                <div className="pt-2 pb-4">
                    {/* Fila 1: buscador + ordenar */}
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full">
                        <div className="relative flex-1 min-w-0 h-9">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 pointer-events-none text-gray-400 dark:text-gray-400">
                                <Search className="w-4 h-4" />
                            </span>
                            <input
                                type="search"
                                placeholder="Buscar productos..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                aria-label="Buscar productos por nombre o marca"
                                className="w-full h-full pl-8 pr-3 py-1.5 bg-white dark:bg-gray-800/80 dark:border-gray-700/80 border border-pink-100 rounded-lg shadow-sm focus:border-pink-300 dark:focus:border-pink-500 focus:ring-2 focus:ring-pink-100/50 dark:focus:ring-pink-900/30 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-300 text-sm transition-all outline-none"
                                suppressHydrationWarning
                            />
                        </div>
                        <div ref={ordenSelectRef} className="relative w-full sm:min-w-[200px] sm:max-w-[240px] shrink-0">
                            <label id="catalogo-ordenar-label" className="sr-only">Ordenar por</label>
                            <button
                                type="button"
                                aria-haspopup="listbox"
                                aria-expanded={ordenSelectOpen}
                                aria-labelledby="catalogo-ordenar-label"
                                aria-label={`Ordenar por: ${ORDEN_OPTIONS.find(o => o.value === (ordenamiento || ORDEN_DEFAULT))?.label ?? ORDEN_OPTIONS[0].label}`}
                                onClick={() => setOrdenSelectOpen(prev => !prev)}
                                className="relative w-full h-9 flex items-center gap-2 pl-3 pr-8 rounded-lg text-sm bg-white dark:bg-gray-700 dark:border-gray-600 border border-pink-100 text-left text-gray-900 dark:text-gray-100 focus:border-pink-300 dark:focus:border-pink-500 focus:ring-2 focus:ring-pink-100/50 dark:focus:ring-pink-900/40 outline-none transition-all min-w-0"
                                suppressHydrationWarning
                            >
                                <span className="flex-1 min-w-0 truncate">
                                    {ORDEN_OPTIONS.find(o => o.value === (ordenamiento || ORDEN_DEFAULT))?.label ?? ORDEN_OPTIONS[0].label}
                                </span>
                                <ChevronDown className={`w-4 h-4 shrink-0 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none transition-transform ${ordenSelectOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {ordenSelectOpen && (
                                <ul
                                    role="listbox"
                                    aria-labelledby="catalogo-ordenar-label"
                                    className="absolute top-full left-0 right-0 z-50 mt-1 py-1 rounded-lg border border-pink-100 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-lg max-h-60 overflow-auto"
                                >
                                    {ORDEN_OPTIONS.map(opt => (
                                        <li key={opt.value} role="option" aria-selected={ordenamiento === opt.value}>
                                            <button
                                                type="button"
                                                className={`w-full text-left px-3 py-2 text-sm transition-colors ${ordenamiento === opt.value ? 'bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 font-medium' : 'text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600/80'}`}
                                                onClick={() => { setOrdenamiento(opt.value); setOrdenSelectOpen(false) }}
                                            >
                                                {opt.label}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* Fila 2: chips de categorías + Más filtros (mobile: chips arriba, botón abajo para no cortarse) */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center pt-6">
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide w-full min-w-0 -mx-1 px-1 sm:flex-1">
                            <button
                                onClick={() => setCategoriaFiltro('all')}
                                className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2 shrink-0 ${categoriaFiltro === 'all'
                                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-200/40 dark:shadow-pink-900/30'
                                    : 'bg-white dark:bg-gray-800/90 dark:border-gray-700 text-gray-600 dark:text-gray-300 border border-pink-100 hover:bg-pink-50/80 dark:hover:bg-gray-700/80 dark:hover:border-gray-600'
                                }`}
                                aria-pressed={categoriaFiltro === 'all'}
                            >
                                Todos
                            </button>
                            {categorias.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setCategoriaFiltro(cat.id.toString())}
                                    className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 shrink-0 ${categoriaFiltro === cat.id.toString()
                                        ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-200/40 dark:shadow-pink-900/30'
                                        : 'bg-white dark:bg-gray-800/90 dark:border-gray-700 text-gray-600 dark:text-gray-300 border border-pink-100 hover:bg-pink-50/80 dark:hover:bg-gray-700/80 dark:hover:border-gray-600'
                                    }`}
                                    aria-pressed={categoriaFiltro === cat.id.toString()}
                                >
{cat.name}
                                        </button>
                                    ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => setMostrarFiltros(!mostrarFiltros)}
                            className={`w-full sm:w-auto shrink-0 h-9 px-3.5 rounded-lg font-medium text-sm flex items-center justify-center gap-1.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${mostrarFiltros ? 'bg-pink-500 text-white' : 'bg-white dark:bg-gray-800/90 dark:border-gray-700 text-gray-600 dark:text-gray-300 border border-pink-100 dark:hover:bg-gray-700/80 dark:hover:border-gray-600'}`}
                            aria-expanded={mostrarFiltros}
                        >
                            {mostrarFiltros ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            {mostrarFiltros ? 'Menos filtros' : 'Más filtros'}
                        </button>
                    </div>

                    {/* Fila 3: panel compacto inline (precio + limpiar) */}
                    {mostrarFiltros && (
                        <div className="mt-4 p-4 rounded-xl border border-pink-100/60 dark:border-gray-700/60 bg-white/80 dark:bg-gray-800/50">
                            <div className="flex flex-wrap items-end gap-4">
                                <div className="min-w-[120px]">
                                    <label htmlFor="catalogo-precio-min" className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Precio mínimo</label>
                                    <input
                                        id="catalogo-precio-min"
                                        type="number"
                                        value={precioMin}
                                        onChange={(e) => setPrecioMin(Number(e.target.value))}
                                        className="w-full h-9 px-3 rounded-lg text-sm bg-gray-50 dark:bg-gray-700/60 border border-pink-100/80 dark:border-gray-600 text-gray-800 dark:text-gray-100 focus:border-pink-300 dark:focus:border-pink-500 focus:ring-2 focus:ring-pink-100/40 dark:focus:ring-pink-900/30 outline-none transition-all"
                                    />
                                </div>
                                <div className="min-w-[120px]">
                                    <label htmlFor="catalogo-precio-max" className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Precio máximo</label>
                                    <input
                                        id="catalogo-precio-max"
                                        type="number"
                                        value={precioMax}
                                        onChange={(e) => setPrecioMax(Number(e.target.value))}
                                        className="w-full h-9 px-3 rounded-lg text-sm bg-gray-50 dark:bg-gray-700/60 border border-pink-100/80 dark:border-gray-600 text-gray-800 dark:text-gray-100 focus:border-pink-300 dark:focus:border-pink-500 focus:ring-2 focus:ring-pink-100/40 dark:focus:ring-pink-900/30 outline-none transition-all"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => { setPrecioMin(0); setPrecioMax(999999); setOrdenamiento(ORDEN_DEFAULT) }}
                                    className="h-9 px-4 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/60 hover:bg-gray-200 dark:hover:bg-gray-700 border-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 transition-colors"
                                >
                                    Limpiar
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Grid de productos */}
                <div className="w-full pb-32">
                {cargando ? (
                    <div className="flex flex-col items-center justify-center py-24">
                        <div className="w-14 h-14 border-4 border-pink-200 dark:border-gray-600 border-t-pink-500 dark:border-t-pink-400 rounded-full animate-spin mb-6" />
                        <p className="text-gray-500 dark:text-gray-400 font-medium">Cargando productos...</p>
                    </div>
                ) : totalItems > 0 ? (
                    <>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 md:gap-6 w-full">
                        {itemsPagina.map((item, slotIndex) => {
                            const esPrioridadLcp = slotIndex < 8
                            const esCombo = 'sale_price' in item && 'combo_items' in item
                            if (esCombo) {
                                const combo = item as ComboConItems
                                const disponible = comboDisponible(combo)
                                return (
                                    <PastelCard key={`combo-${combo.id}`} className="content-visibility-auto group overflow-hidden flex flex-col h-full transition-all duration-300 hover:shadow-[0_8px_28px_rgba(236,72,153,0.15)] dark:bg-gray-800/95 dark:border-gray-700/80 dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.4)] hover:-translate-y-0.5">
                                        <div className="relative aspect-square overflow-hidden rounded-t-[20px] bg-gray-50 dark:bg-gray-700/80 cursor-pointer" onClick={() => startTransition(() => setComboSeleccionado(combo))}>
                                            <ImagenComboRotativa
                                                combo={combo}
                                                fill
                                                className="absolute inset-0 w-full h-full"
                                                sizes="(max-width: 768px) 50vw, 25vw"
                                                priority={esPrioridadLcp}
                                            />
                                            <BadgeRotator badges={[{ texto: 'Combo', clase: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-200/50' }]} />
                                            <button
                                                onClick={(e) => { e.stopPropagation(); window.location.href = `https://wa.me/${WHATSAPP_NUMBER}?text=¡Mirá este combo!%0A%0A*${combo.name}*%0APrecio: $${combo.sale_price.toLocaleString()}%0A%0A¿Te interesa?` }}
                                                className="absolute top-4 right-4 p-2.5 rounded-xl bg-white/90 backdrop-blur-sm text-gray-500 shadow-md hover:text-pink-600 hover:bg-white transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                aria-label={`Compartir ${combo.name}`}
                                            >
                                                <Share2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="p-4 flex flex-col flex-1 min-h-0 cursor-pointer" onClick={() => startTransition(() => setComboSeleccionado(combo))}>
                                            <div className="flex-1 min-h-[4.5rem] flex flex-col">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 dark:text-amber-400 mb-1">Combo</span>
                                                <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-snug line-clamp-2 mb-1.5">{combo.name}</h3>
                                                {combo.description ? <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{combo.description}</p> : <span className="min-h-[1.25rem]" aria-hidden />}
                                            </div>
                                            <div className="mt-auto pt-3 border-t border-pink-50 dark:border-gray-600/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 flex-shrink-0">
                                                <p className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tabular-nums">${combo.sale_price.toLocaleString()}</p>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); if (disponible) startTransition(() => agregarComboAlCarrito(combo)); }}
                                                    disabled={!disponible}
                                                    className="w-full sm:w-auto flex-shrink-0 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold shadow-md hover:shadow-lg hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px] transition-all duration-200"
                                                    aria-label={disponible ? `Agregar ${combo.name}` : `${combo.name}: agotado`}
                                                >
                                                    {disponible ? 'Agregar' : 'Agotado'}
                                                </button>
                                            </div>
                                        </div>
                                    </PastelCard>
                                )
                            }
                            const producto = item as Producto
                            const badges = obtenerBadges(producto)
                            const images = getProductImages(producto)
                            const idx = indiceImagenPorProducto[producto.id] ?? 0
                            const currentImage = images[idx]
                            const setIdx = (delta: number) => {
                                const next = (idx + delta + images.length) % images.length
                                setIndiceImagenPorProducto(prev => ({ ...prev, [producto.id]: next }))
                            }
                            return (
                                <PastelCard key={producto.id} className="content-visibility-auto group overflow-hidden flex flex-col h-full transition-all duration-300 hover:shadow-[0_8px_28px_rgba(236,72,153,0.15)] dark:bg-gray-800/95 dark:border-gray-700/80 dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.4)] hover:-translate-y-0.5">
                                    <div
                                        className="relative aspect-square overflow-hidden rounded-t-[20px] bg-gray-50 dark:bg-gray-700/80 touch-pan-y"
                                        onClick={() => startTransition(() => { if (images.length > 0) setImagenPrevia({ images, index: idx }) })}
                                        onTouchStart={e => {
                                            if (images.length > 1) touchSwipeRef.current = { productId: producto.id, x: e.targetTouches[0].clientX, count: images.length }
                                        }}
                                        onTouchEnd={e => {
                                            const ref = touchSwipeRef.current
                                            if (!ref || ref.productId !== producto.id) return
                                            const end = e.changedTouches[0].clientX
                                            const delta = ref.x - end
                                            if (Math.abs(delta) > 50) {
                                                const dir = delta > 0 ? 1 : -1
                                                setIndiceImagenPorProducto(prev => {
                                                    const cur = prev[ref.productId] ?? 0
                                                    const next = (cur + dir + ref.count) % ref.count
                                                    return { ...prev, [ref.productId]: next }
                                                })
                                            }
                                            touchSwipeRef.current = null
                                        }}
                                    >
                                        {currentImage ? (
                                            <Image
                                                src={currentImage}
                                                alt={producto.name}
                                                fill
                                                className="object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none"
                                                sizes="(max-width: 768px) 50vw, 25vw"
                                                priority={esPrioridadLcp}
                                                loading={esPrioridadLcp ? 'eager' : undefined}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center"><Sparkles className="w-16 h-16 text-pink-200 dark:text-pink-500/60" /></div>
                                        )}
                                        {images.length > 1 && (
                                            <>
                                                <button type="button" onClick={e => { e.stopPropagation(); setIdx(-1) }} className="absolute left-1 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 shadow-md hover:bg-white text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity z-10" aria-label="Anterior">
                                                    <ChevronLeft className="w-5 h-5" />
                                                </button>
                                                <button type="button" onClick={e => { e.stopPropagation(); setIdx(1) }} className="absolute right-1 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 shadow-md hover:bg-white text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity z-10" aria-label="Siguiente">
                                                    <ChevronRight className="w-5 h-5" />
                                                </button>
                                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                                                    {images.map((_, i) => (
                                                        <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === idx ? 'bg-white shadow' : 'bg-white/50'}`} aria-hidden />
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                        {badges.length > 0 && <BadgeRotator badges={badges} />}
                                        <button onClick={e => { e.stopPropagation(); compartirProducto(producto) }} className="absolute top-4 right-4 p-2.5 rounded-xl bg-white/90 backdrop-blur-sm text-gray-500 shadow-md hover:text-pink-600 hover:bg-white transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 z-10" aria-label={`Compartir ${producto.name}`}>
                                            <Share2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="p-4 flex flex-col flex-1 min-h-0">
                                        <div className="flex-1 min-h-[4.5rem] flex flex-col">
                                            {producto.categories ? <span className="text-[10px] font-bold uppercase tracking-wider text-pink-500 dark:text-pink-400 mb-1">{producto.categories.name}</span> : <span className="min-h-[0.875rem]" aria-hidden />}
                                            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-snug line-clamp-2 mb-1.5">{producto.name}</h3>
                                            {producto.brand ? <p className="text-xs text-gray-500 dark:text-gray-400">{producto.brand}</p> : <span className="min-h-[1rem]" aria-hidden />}
                                        </div>
                                        <div className="mt-auto pt-3 border-t border-pink-50 dark:border-gray-600/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 flex-shrink-0">
                                            <div className="min-w-0">
                                                {(producto.discount_percentage ?? 0) > 0 ? (
                                                    <><p className="text-xs text-gray-400 dark:text-gray-500 line-through">${producto.sale_price.toLocaleString()}</p><p className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tabular-nums">${getPrecioConDescuento(producto).toLocaleString()}</p></>
                                                ) : (
                                                    <p className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tabular-nums">${producto.sale_price.toLocaleString()}</p>
                                                )}
                                            </div>
                                            <button onClick={() => producto.stock > 0 && startTransition(() => agregarAlCarrito(producto))} disabled={producto.stock === 0} className="w-full sm:w-auto flex-shrink-0 px-4 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white text-sm font-bold shadow-md hover:shadow-lg hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px] transition-all duration-200">
                                                {producto.stock === 0 ? 'Agotado' : 'Agregar'}
                                            </button>
                                        </div>
                                    </div>
                                </PastelCard>
                            )
                        })}
                    </div>

                    {totalPaginas > 1 && (
                        <div className="paginacion-catalogo-wrapper">
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Mostrando {inicio + 1}–{Math.min(inicio + PRODUCTOS_POR_PAGINA, totalItems)} de {totalItems}
                            </p>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                                    disabled={paginaActual === 1}
                                    className="p-2.5 rounded-xl border border-pink-200 dark:border-gray-600 text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                                    aria-label="Página anterior"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div className="flex items-center gap-1 mx-1">
                                    {Array.from({ length: totalPaginas }, (_, i) => i + 1).map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setPaginaActual(p)}
                                            className={`min-w-[36px] h-9 px-2 rounded-xl font-semibold text-sm transition-colors ${
                                                p === paginaActual
                                                    ? 'bg-pink-500 text-white shadow-md shadow-pink-200/50 dark:shadow-pink-900/30'
                                                    : 'border border-pink-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-pink-50 dark:hover:bg-gray-700 hover:border-pink-300 dark:hover:border-gray-500'
                                            }`}
                                            aria-label={`Página ${p}`}
                                            aria-current={p === paginaActual ? 'page' : undefined}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                                    disabled={paginaActual === totalPaginas}
                                    className="p-2.5 rounded-xl border border-pink-200 dark:border-gray-600 text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
                                    aria-label="Página siguiente"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                            </div>
                        </div>
                    )}
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-24 h-24 rounded-full bg-pink-50 dark:bg-gray-800 flex items-center justify-center mb-6">
                            <Search className="w-12 h-12 text-pink-300 dark:text-pink-500" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">No se encontraron productos</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm">Probá con otros filtros o una búsqueda diferente.</p>
                        <button
                            onClick={() => { setBusqueda(''); setCategoriaFiltro('all'); setPrecioMin(0); setPrecioMax(999999) }}
                            className="px-6 py-3 rounded-xl bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 font-bold hover:bg-pink-100 dark:hover:bg-pink-900/50 transition-colors"
                        >
                            Limpiar filtros
                        </button>
                    </div>
                )}
                </div>
            </div>

            {/* Botón flotante carrito */}
            {carrito.length > 0 && !mostrarCarrito && (
                <button
                    type="button"
                    onClick={() => startTransition(() => setMostrarCarrito(true))}
                    className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-2xl shadow-xl shadow-pink-400/50 dark:shadow-pink-900/40 hover:shadow-2xl hover:shadow-pink-400/60 hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 font-bold text-base"
                    aria-label={`Abrir carrito, ${carrito.length} ítems, total ${total.toLocaleString()} pesos`}
                >
                    <div className="relative">
                        <ShoppingBag className="w-6 h-6" />
                        <span className="absolute -top-2 -right-2 bg-white text-pink-600 text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center">
                            {carrito.length}
                        </span>
                    </div>
                    <span className="font-extrabold text-lg">${total.toLocaleString()}</span>
                </button>
            )}

            <ModalCarrito
                open={mostrarCarrito}
                onClose={() => setMostrarCarrito(false)}
                carrito={carrito}
                getPrecioConDescuento={getPrecioConDescuento}
                quitarDelCarrito={quitarDelCarrito}
                quitarComboDelCarrito={quitarComboDelCarrito}
                actualizarCantidad={actualizarCantidad}
                actualizarCantidadCombo={actualizarCantidadCombo}
                cuponInput={cuponInput}
                setCuponInput={setCuponInput}
                appliedCoupon={appliedCoupon}
                onAplicarCupon={aplicarCupon}
                quitarCupon={quitarCupon}
                subtotal={subtotal}
                descuentoCupon={descuentoCupon}
                total={total}
                onWhatsApp={handleWhatsAppClick}
                onSolicitarVaciar={() => setMostrarConfirmacion(true)}
            />

            <ModalConfirmacionVaciar
                open={mostrarConfirmacion}
                onClose={() => setMostrarConfirmacion(false)}
                onConfirm={vaciarCarrito}
            />

            {imagenPrevia && (
                <ModalImagenPrevia images={imagenPrevia.images} initialIndex={imagenPrevia.index} onClose={() => setImagenPrevia(null)} />
            )}

            {comboSeleccionado && (
                <ModalDetalleCombo
                    combo={comboSeleccionado}
                    onClose={() => setComboSeleccionado(null)}
                    onAgregar={() => agregarComboAlCarrito(comboSeleccionado)}
                    disponible={comboDisponible(comboSeleccionado)}
                />
            )}

        </div>
    )
}
