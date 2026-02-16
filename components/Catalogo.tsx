'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, Producto, Categoria, ItemCarrito } from '@/lib/supabase'
import { Search, ShoppingBag, Share2, SlidersHorizontal, Sparkles } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import confetti from 'canvas-confetti'
import { WHATSAPP_NUMBER } from '@/lib/config'
import { useToast } from '@/context/ToastContext'
import { PastelCard } from '@/components/ui/PastelCard'
import { BadgeRotator } from '@/components/Catalogo/BadgeRotator'
import { ModalCarrito } from '@/components/Catalogo/ModalCarrito'
import { ModalConfirmacionVaciar } from '@/components/Catalogo/ModalConfirmacionVaciar'
import { ModalImagenPrevia } from '@/components/Catalogo/ModalImagenPrevia'
import { ModalEasterEgg } from '@/components/Catalogo/ModalEasterEgg'
import { useCarrito } from '@/hooks/useCarrito'

const KONAMI = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65] // ↑↑↓↓←→←→BA
const DEVICE_ID_KEY = 'ilara_easter_device_id'
const TAPS_NEEDED = 7

export default function Catalogo() {
    const { showToast } = useToast()
    const { carrito, agregarAlCarrito, quitarDelCarrito, actualizarCantidad, clearCarrito, mantenerSoloProductosDisponibles, badgeAnimado } = useCarrito(showToast)
    const [productos, setProductos] = useState<Producto[]>([])
    const [categorias, setCategorias] = useState<Categoria[]>([])
    const [categoriaFiltro, setCategoriaFiltro] = useState<string>('all')
    const [busqueda, setBusqueda] = useState('')
    const [mostrarCarrito, setMostrarCarrito] = useState(false)
    const [cargando, setCargando] = useState(true)
    const [precioMin, setPrecioMin] = useState<number>(0)
    const [precioMax, setPrecioMax] = useState<number>(999999)
    const [ordenamiento, setOrdenamiento] = useState<string>('nombre-asc')
    const [imagenPrevia, setImagenPrevia] = useState<string | null>(null)
    const [mostrarFiltros, setMostrarFiltros] = useState(false)
    const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)
    const [cuponInput, setCuponInput] = useState('')
    const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount_percentage: number } | null>(null)
    const [easterModal, setEasterModal] = useState<{ open: boolean; code?: string; alreadyClaimed?: boolean }>({ open: false })
    const konamiIndex = useRef(0)
    const logoTapCount = useRef(0)
    const logoTapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

    const getOrCreateDeviceId = useCallback(() => {
        if (typeof window === 'undefined') return ''
        let id = localStorage.getItem(DEVICE_ID_KEY)
        if (!id) {
            id = crypto.randomUUID?.() ?? `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`
            localStorage.setItem(DEVICE_ID_KEY, id)
        }
        return id
    }, [])

    const triggerEaster = useCallback(async () => {
        const deviceId = getOrCreateDeviceId()
        try {
            const res = await fetch('/api/easter-claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                showToast('error', data.error ?? 'No se pudo activar el cupón')
                return
            }
            confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })
            setEasterModal({
                open: true,
                code: data.code,
                alreadyClaimed: data.alreadyClaimed === true,
            })
        } catch {
            showToast('error', 'Error de conexión')
        }
    }, [getOrCreateDeviceId, showToast])

    useEffect(() => {
        obtenerProductos()
        obtenerCategorias()
    }, [])

    // Al salir del catálogo, vaciar el carrito para no arrastrar pedidos viejos
    useEffect(() => {
        return () => { clearCarrito() }
    }, [clearCarrito])

    // Al cargar productos (o cuando el carrito se hidrata desde localStorage), quitar ítems que ya no existan o superen stock
    useEffect(() => {
        if (productos.length > 0 && carrito.length > 0) {
            mantenerSoloProductosDisponibles(productos)
        }
    }, [productos, carrito.length, mantenerSoloProductosDisponibles])

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.keyCode === KONAMI[konamiIndex.current]) {
                konamiIndex.current++
                if (konamiIndex.current === KONAMI.length) {
                    konamiIndex.current = 0
                    triggerEaster()
                }
            } else {
                konamiIndex.current = 0
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [triggerEaster])

    const handleLogoTap = useCallback(() => {
        if (logoTapTimeout.current) clearTimeout(logoTapTimeout.current)
        logoTapCount.current += 1
        if (logoTapCount.current >= TAPS_NEEDED) {
            logoTapCount.current = 0
            triggerEaster()
        } else {
            logoTapTimeout.current = setTimeout(() => { logoTapCount.current = 0 }, 1500)
        }
    }, [triggerEaster])

    const obtenerProductos = async () => {
        setCargando(true)
        const { data } = await supabase
            .from('products')
            .select('*, categories(name)')
            .gte('stock', 0)
            .order('name')
        if (data) setProductos(data)
        setCargando(false)
    }

    const obtenerCategorias = async () => {
        const { data } = await supabase
            .from('categories')
            .select('*')
            .order('name')
        if (data) setCategorias(data)
    }

    // Badge "Nuevo" durante 7 días desde created_at
    const esNuevo = (fecha: string) => {
        const ahora = new Date()
        const fechaProducto = new Date(fecha)
        const diferencia = ahora.getTime() - fechaProducto.getTime()
        const dias = diferencia / (1000 * 3600 * 24)
        return dias <= 7
    }

    const getPrecioConDescuento = (producto: Producto): number => {
        const d = producto.discount_percentage ?? 0
        if (d <= 0) return producto.sale_price
        return Math.round(producto.sale_price * (1 - d / 100))
    }

    const obtenerBadges = (producto: Producto): Array<{ texto: string; clase: string }> => {
        const badges: Array<{ texto: string; clase: string }> = []
        if (producto.stock === 0) {
            badges.push({ texto: 'Agotado', clase: 'bg-gray-500 text-white shadow-md shadow-gray-200/50' })
            return badges
        }
        if ((producto.discount_percentage ?? 0) > 0) badges.push({ texto: '🔥 En descuento', clase: 'bg-orange-500 text-white shadow-md shadow-orange-200/50' })
        if (esNuevo(producto.created_at)) badges.push({ texto: 'Nuevo', clase: 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-200/50' })
        if (producto.stock <= 2) badges.push({ texto: 'Últimas unidades', clase: 'bg-rose-600 text-white shadow-md shadow-rose-200/50' })
        else if (producto.stock < 5) badges.push({ texto: '¡Últimos!', clase: 'bg-amber-500 text-white shadow-md shadow-amber-200/50' })
        return badges
    }

    const productosFiltrados = productos
        .filter(p => {
            if (categoriaFiltro !== 'all' && p.category_id?.toString() !== categoriaFiltro) return false
            if (busqueda) {
                const termino = busqueda.toLowerCase()
                if (!p.name.toLowerCase().includes(termino) && !p.brand?.toLowerCase().includes(termino)) return false
            }
            const precioProd = getPrecioConDescuento(p)
            if (precioProd < precioMin || precioProd > precioMax) return false
            return true
        })
        .sort((a, b) => {
            const precioA = getPrecioConDescuento(a)
            const precioB = getPrecioConDescuento(b)
            switch (ordenamiento) {
                case 'precio-asc': return precioA - precioB
                case 'precio-desc': return precioB - precioA
                case 'nombre-desc': return b.name.localeCompare(a.name)
                default: return a.name.localeCompare(b.name)
            }
        })

    const vaciarCarrito = () => {
        clearCarrito()
        setAppliedCoupon(null)
        setMostrarConfirmacion(false)
        setMostrarCarrito(false)
        showToast('info', 'Carrito vaciado')
    }

    const subtotal = carrito.reduce((sum, item) => sum + (getPrecioConDescuento(item.producto) * item.cantidad), 0)
    const descuentoCupon = appliedCoupon ? Math.round(subtotal * (appliedCoupon.discount_percentage / 100)) : 0
    const total = subtotal - descuentoCupon

    const aplicarCupon = async () => {
        const code = cuponInput.trim().toUpperCase()
        if (!code) {
            showToast('warning', 'Escribí un código')
            return
        }
        const { data, error } = await supabase
            .from('coupons')
            .select('discount_percentage')
            .eq('code', code)
            .eq('is_active', true)
            .maybeSingle()
        if (error || !data) {
            showToast('error', 'Cupón inválido o inactivo')
            return
        }
        setAppliedCoupon({ code, discount_percentage: data.discount_percentage })
        setCuponInput('')
        showToast('success', `Cupón ${code} aplicado: -${data.discount_percentage}%`)
    }

    const quitarCupon = () => {
        setAppliedCoupon(null)
    }

    const handleWhatsAppClick = () => {
        if (carrito.length === 0) return
        const items = carrito.map(item => {
            const precioUnit = getPrecioConDescuento(item.producto)
            return `• ${item.producto.name} x${item.cantidad} - $${(precioUnit * item.cantidad).toLocaleString()}`
        }).join('%0A')
        let totalLine = `*Total: $${total.toLocaleString()}*`
        if (appliedCoupon) totalLine = `Cupón ${appliedCoupon.code} (-${appliedCoupon.discount_percentage}%)%0A${totalLine}`
        const mensaje = `¡Hola! Me gustaría hacer el siguiente pedido:%0A%0A${items}%0A%0A${totalLine}`
        window.location.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${mensaje}`
    }

    const compartirProducto = (producto: Producto) => {
        const precio = getPrecioConDescuento(producto)
        const mensaje = `¡Mirá este producto!%0A%0A*${producto.name}*%0A${producto.brand ? producto.brand + '%0A' : ''}Precio: $${precio.toLocaleString()}%0A%0A¿Te interesa?`
        window.location.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${mensaje}`
    }

    return (
        <div className="min-h-screen w-full min-w-0 bg-gradient-to-b from-pink-50/30 via-white to-pink-50/20">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-pink-100/50 shadow-sm shadow-pink-500/5">
                <div className="w-full px-4 sm:px-6 lg:px-8 py-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={handleLogoTap}
                                className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0 bg-white border border-pink-100 shadow-lg shadow-pink-200/50 flex items-center justify-center cursor-pointer touch-manipulation"
                                aria-label="Ilara Beauty"
                            >
                                <Image src="/logo_icon.png" alt="Ilara Beauty" width={48} height={48} className="object-contain w-full h-full" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Ilara Beauty</h1>
                                <p className="text-xs text-gray-500 font-medium mt-0.5">Catálogo · Pedí por WhatsApp</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Link
                                href="/login"
                                className="px-4 py-2.5 rounded-2xl border-2 border-pink-100 text-gray-600 font-semibold text-sm hover:border-pink-200 hover:text-pink-600 transition-all duration-300"
                            >
                                Login
                            </Link>
                            <button
                                onClick={() => setMostrarCarrito(true)}
                                className="relative p-3 rounded-2xl bg-pink-50 hover:bg-pink-100 transition-all duration-300 group focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2"
                                aria-label={carrito.length > 0 ? `Ver carrito, ${carrito.length} producto${carrito.length !== 1 ? 's' : ''}` : 'Ver carrito'}
                            >
                                <ShoppingBag className="w-6 h-6 text-pink-600 group-hover:scale-110 transition-transform" />
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

            {/* Búsqueda y filtros */}
            <div className="w-full px-4 sm:px-6 lg:px-8 py-6 mt-8">
                <div className="flex justify-center w-full mb-10px">
                    <div className="flex flex-col sm:flex-row gap-4 w-full sm:max-w-2xl">
                        <div className="relative flex-1 min-w-0">
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 pointer-events-none">
                                <Search className="w-5 h-5 text-gray-400" />
                            </span>
                            <input
                                type="search"
                                placeholder="Buscar productos..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                aria-label="Buscar productos por nombre o marca"
                                className="w-full pl-5 pr-12 py-4 bg-white border border-pink-100 rounded-2xl shadow-sm focus:border-pink-300 focus:ring-4 focus:ring-pink-100/50 focus-visible:ring-4 focus-visible:ring-pink-100/50 text-gray-800 placeholder-gray-400 transition-all outline-none"
                            />
                        </div>
                        <button
                            onClick={() => setMostrarFiltros(!mostrarFiltros)}
                            className={`flex-shrink-0 px-6 py-[10px] rounded-2xl border-2 transition-all flex items-center gap-2 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2 ${mostrarFiltros ? 'bg-pink-50 border-pink-200 text-pink-600' : 'bg-white border-pink-100 text-gray-500 hover:border-pink-200 hover:text-pink-600'}`}
                            aria-label={mostrarFiltros ? 'Cerrar filtros' : 'Abrir filtros'}
                            aria-expanded={mostrarFiltros}
                        >
                            <SlidersHorizontal className="w-5 h-5" />
                            Filtros
                        </button>
                    </div>
                </div>

                {mostrarFiltros && (
                    <PastelCard className="mb-6 p-6 animate-fade-in-scale" noHover>
                        <h3 className="text-sm font-bold text-gray-700 mb-4">Filtros y ordenamiento</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="text-xs text-gray-500 font-semibold mb-2 block">Precio mínimo</label>
                                <input
                                    type="number"
                                    value={precioMin}
                                    onChange={(e) => setPrecioMin(Number(e.target.value))}
                                    className="w-full px-4 py-3 bg-white border border-pink-100 rounded-xl text-gray-800 focus:border-pink-300 focus:ring-2 focus:ring-pink-100 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 font-semibold mb-2 block">Precio máximo</label>
                                <input
                                    type="number"
                                    value={precioMax}
                                    onChange={(e) => setPrecioMax(Number(e.target.value))}
                                    className="w-full px-4 py-3 bg-white border border-pink-100 rounded-xl text-gray-800 focus:border-pink-300 focus:ring-2 focus:ring-pink-100 outline-none transition-all"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs text-gray-500 font-semibold mb-2 block">Ordenar por</label>
                                <select
                                    value={ordenamiento}
                                    onChange={(e) => setOrdenamiento(e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-pink-100 rounded-xl text-gray-800 focus:border-pink-300 focus:ring-2 focus:ring-pink-100 outline-none transition-all"
                                >
                                    <option value="nombre-asc">Nombre (A-Z)</option>
                                    <option value="nombre-desc">Nombre (Z-A)</option>
                                    <option value="precio-asc">Precio (menor a mayor)</option>
                                    <option value="precio-desc">Precio (mayor a menor)</option>
                                </select>
                            </div>
                        </div>
                    </PastelCard>
                )}

                {/* Categorías */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1 w-full">
<button
                                        onClick={() => setCategoriaFiltro('all')}
                                        className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2 ${categoriaFiltro === 'all'
                            ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-200/50'
                            : 'bg-white text-gray-600 border-2 border-pink-100 hover:border-pink-200 hover:text-pink-600'
                        }`}
                                        aria-pressed={categoriaFiltro === 'all'}
                                    >
                                        Todos
                                    </button>
{categorias.map(cat => (
                                        <button
                                            key={cat.id}
                                            onClick={() => setCategoriaFiltro(cat.id.toString())}
                                            className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2 ${categoriaFiltro === cat.id.toString()
                                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-200/50'
                                : 'bg-white text-gray-600 border-2 border-pink-100 hover:border-pink-200 hover:text-pink-600'
                            }`}
                                            aria-pressed={categoriaFiltro === cat.id.toString()}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                </div>
            </div>

            {/* Grid de productos */}
            <div className="w-full px-4 sm:px-6 lg:px-8 pb-32">
                {cargando ? (
                    <div className="flex flex-col items-center justify-center py-24">
                        <div className="w-14 h-14 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin mb-6" />
                        <p className="text-gray-500 font-medium">Cargando productos...</p>
                    </div>
                ) : productosFiltrados.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 md:gap-6 w-full">
                        {productosFiltrados.map(producto => {
                            const badges = obtenerBadges(producto)
                            return (
                                <PastelCard key={producto.id} className="group overflow-hidden flex flex-col h-full" noHover>
                                    <div className="relative aspect-square overflow-hidden rounded-t-[20px] bg-gray-50">
                                        {producto.image_url ? (
                                            <Image
                                                src={producto.image_url}
                                                alt={producto.name}
                                                fill
                                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                                onClick={() => setImagenPrevia(producto.image_url)}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Sparkles className="w-16 h-16 text-pink-200" />
                                            </div>
                                        )}
                                        {badges.length > 0 && <BadgeRotator badges={badges} />}
                                        <button
                                            onClick={() => compartirProducto(producto)}
                                            className="absolute top-4 right-4 p-2.5 rounded-xl bg-white/90 backdrop-blur-sm text-gray-500 shadow-md hover:text-pink-600 hover:bg-white transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
                                            aria-label={`Compartir ${producto.name} por WhatsApp`}
                                        >
                                            <Share2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="p-5 flex flex-col flex-1">
                                        {producto.categories && (
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-pink-500 mb-1.5">
                                                {producto.categories.name}
                                            </span>
                                        )}
                                        <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 mb-2">
                                            {producto.name}
                                        </h3>
                                        {producto.brand && (
                                            <p className="text-xs text-gray-500 mb-3">{producto.brand}</p>
                                        )}

                                        <div className="mt-auto pt-4 border-t border-pink-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                            <div className="min-w-0">
                                                {(producto.discount_percentage ?? 0) > 0 ? (
                                                    <>
                                                        <p className="text-sm text-gray-400 line-through">${producto.sale_price.toLocaleString()}</p>
                                                        <p className="text-xl font-extrabold text-gray-900">${getPrecioConDescuento(producto).toLocaleString()}</p>
                                                    </>
                                                ) : (
                                                    <p className="text-xl font-extrabold text-gray-900">${producto.sale_price.toLocaleString()}</p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => producto.stock > 0 && agregarAlCarrito(producto)}
                                                disabled={producto.stock === 0}
                                                className="w-full sm:w-auto flex-shrink-0 px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white text-sm font-bold shadow-md shadow-pink-200/50 hover:shadow-lg hover:shadow-pink-200/60 hover:scale-105 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-pink-100"
                                                aria-label={producto.stock === 0 ? `${producto.name}: agotado` : `Agregar ${producto.name} al carrito`}
                                            >
                                                {producto.stock === 0 ? 'Agotado' : 'Agregar'}
                                            </button>
                                        </div>
                                    </div>
                                </PastelCard>
                            )
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-24 h-24 rounded-full bg-pink-50 flex items-center justify-center mb-6">
                            <Search className="w-12 h-12 text-pink-300" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">No se encontraron productos</h3>
                        <p className="text-gray-500 mb-6 max-w-sm">Probá con otros filtros o una búsqueda diferente.</p>
                        <button
                            onClick={() => { setBusqueda(''); setCategoriaFiltro('all'); setPrecioMin(0); setPrecioMax(999999) }}
                            className="px-6 py-3 rounded-xl bg-pink-50 text-pink-600 font-bold hover:bg-pink-100 transition-colors"
                        >
                            Limpiar filtros
                        </button>
                    </div>
                )}
            </div>

            {/* Botón flotante carrito */}
            {carrito.length > 0 && !mostrarCarrito && (
                <button
                    onClick={() => setMostrarCarrito(true)}
                    className="fixed bottom-8 right-8 z-50 flex items-center gap-4 px-6 py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-2xl shadow-xl shadow-pink-300/40 hover:shadow-2xl hover:shadow-pink-300/50 hover:scale-105 active:scale-95 transition-all animate-float"
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
                actualizarCantidad={actualizarCantidad}
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
                <ModalImagenPrevia imageUrl={imagenPrevia} onClose={() => setImagenPrevia(null)} />
            )}

            <ModalEasterEgg
                open={easterModal.open}
                code={easterModal.code}
                alreadyClaimed={easterModal.alreadyClaimed}
                onClose={() => setEasterModal(m => ({ ...m, open: false }))}
            />
        </div>
    )
}
