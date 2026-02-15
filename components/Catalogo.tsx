'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, Producto, Categoria, ItemCarrito } from '@/lib/supabase'
import { Search, ShoppingBag, Plus, Minus, Trash2, MessageCircle, X, Share2, SlidersHorizontal, Sparkles } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import confetti from 'canvas-confetti'
import { WHATSAPP_NUMBER } from '@/lib/config'
import { useToast } from '@/context/ToastContext'
import { PastelCard } from '@/components/ui/PastelCard'

const KONAMI = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65] // ↑↑↓↓←→←→BA
const DEVICE_ID_KEY = 'ilara_easter_device_id'
const TAPS_NEEDED = 7
const BADGE_VISIBLE_MS = 3000
const BADGE_FADE_MS = 900

function BadgeRotator({ badges }: { badges: Array<{ texto: string; clase: string }> }) {
    const [index, setIndex] = useState(0)
    const [opacity, setOpacity] = useState(1)
    const [visible, setVisible] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = containerRef.current?.closest('.group')
        if (!el) return
        const obs = new IntersectionObserver(
            ([e]) => setVisible(e.isIntersecting),
            { rootMargin: '100px', threshold: 0 }
        )
        obs.observe(el)
        return () => obs.disconnect()
    }, [])

    useEffect(() => {
        if (badges.length <= 1 || !visible) return
        let timeoutId: ReturnType<typeof setTimeout>
        const cycleMs = BADGE_VISIBLE_MS + BADGE_FADE_MS * 2
        const id = setInterval(() => {
            setOpacity(0)
            timeoutId = setTimeout(() => {
                setIndex(i => (i + 1) % badges.length)
                setOpacity(1)
            }, BADGE_FADE_MS)
        }, cycleMs)
        return () => {
            clearInterval(id)
            if (timeoutId) clearTimeout(timeoutId)
        }
    }, [badges.length, visible])
    if (badges.length === 0) return null
    const badge = badges[index]
    return (
        <div ref={containerRef} className="absolute top-4 left-4 min-w-0 max-w-[70%]">
            <span
                className={`inline-block px-3 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wider shadow-lg whitespace-nowrap ${badge.clase}`}
                style={{ opacity, transition: `opacity ${BADGE_FADE_MS}ms ease` }}
            >
                {badge.texto}
            </span>
        </div>
    )
}

export default function Catalogo() {
    const { showToast } = useToast()
    const [productos, setProductos] = useState<Producto[]>([])
    const [categorias, setCategorias] = useState<Categoria[]>([])
    const [carrito, setCarrito] = useState<ItemCarrito[]>([])
    const [categoriaFiltro, setCategoriaFiltro] = useState<string>('all')
    const [busqueda, setBusqueda] = useState('')
    const [mostrarCarrito, setMostrarCarrito] = useState(false)
    const [cargando, setCargando] = useState(true)
    const [badgeAnimado, setBadgeAnimado] = useState(false)
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
        const carritoGuardado = localStorage.getItem('ilara-carrito')
        if (carritoGuardado) {
            try {
                setCarrito(JSON.parse(carritoGuardado))
            } catch (e) {
                console.error('Error al cargar carrito:', e)
            }
        }
    }, [])

    useEffect(() => {
        if (carrito.length > 0) {
            localStorage.setItem('ilara-carrito', JSON.stringify(carrito))
        } else {
            localStorage.removeItem('ilara-carrito')
        }
    }, [carrito])

    useEffect(() => {
        obtenerProductos()
        obtenerCategorias()
    }, [])

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

    const agregarAlCarrito = (producto: Producto) => {
        const existente = carrito.find(item => item.producto.id === producto.id)
        if (existente) {
            if (existente.cantidad < producto.stock) {
                setCarrito(carrito.map(item =>
                    item.producto.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
                ))
                showToast('success', 'Cantidad actualizada')
            } else {
                showToast('warning', 'Stock máximo alcanzado')
            }
        } else {
            setCarrito([...carrito, { producto, cantidad: 1 }])
            showToast('success', `${producto.name} agregado`)
        }
        setBadgeAnimado(true)
        setTimeout(() => setBadgeAnimado(false), 500)
    }

    const actualizarCantidad = (productoId: number, cambio: number) => {
        setCarrito(carrito.map(item => {
            if (item.producto.id === productoId) {
                const nuevaCantidad = item.cantidad + cambio
                if (nuevaCantidad <= 0) return item
                if (nuevaCantidad > item.producto.stock) {
                    showToast('warning', 'Stock máximo alcanzado')
                    return item
                }
                return { ...item, cantidad: nuevaCantidad }
            }
            return item
        }).filter(item => item.cantidad > 0))
    }

    const quitarDelCarrito = (productoId: number) => {
        setCarrito(carrito.filter(item => item.producto.id !== productoId))
        showToast('info', 'Producto eliminado')
    }

    const vaciarCarrito = () => {
        setCarrito([])
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
                                className="relative p-3 rounded-2xl bg-pink-50 hover:bg-pink-100 transition-all duration-300 group"
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
                                type="text"
                                placeholder="Buscar productos..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                className="w-full pl-5 pr-12 py-4 bg-white border border-pink-100 rounded-2xl shadow-sm focus:border-pink-300 focus:ring-4 focus:ring-pink-100/50 text-gray-800 placeholder-gray-400 transition-all outline-none"
                            />
                        </div>
                        <button
                            onClick={() => setMostrarFiltros(!mostrarFiltros)}
                            className={`flex-shrink-0 px-6 py-4 rounded-2xl border-2 transition-all flex items-center gap-2 font-semibold ${mostrarFiltros ? 'bg-pink-50 border-pink-200 text-pink-600' : 'bg-white border-pink-100 text-gray-500 hover:border-pink-200 hover:text-pink-600'}`}
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
                        className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${categoriaFiltro === 'all'
                            ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-200/50'
                            : 'bg-white text-gray-600 border-2 border-pink-100 hover:border-pink-200 hover:text-pink-600'
                        }`}
                    >
                        Todos
                    </button>
                    {categorias.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setCategoriaFiltro(cat.id.toString())}
                            className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${categoriaFiltro === cat.id.toString()
                                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-200/50'
                                : 'bg-white text-gray-600 border-2 border-pink-100 hover:border-pink-200 hover:text-pink-600'
                            }`}
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
                                            className="absolute top-4 right-4 p-2.5 rounded-xl bg-white/90 backdrop-blur-sm text-gray-500 shadow-md hover:text-pink-600 hover:bg-white transition-all opacity-0 group-hover:opacity-100"
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
                                                className="w-full sm:w-auto flex-shrink-0 px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white text-sm font-bold shadow-md shadow-pink-200/50 hover:shadow-lg hover:shadow-pink-200/60 hover:scale-105 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
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

            {/* Modal carrito */}
            {mostrarCarrito && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMostrarCarrito(false)} />

                    <PastelCard className="w-full max-w-md max-h-[90vh] flex flex-col z-50 animate-slide-up sm:animate-fade-in-scale shadow-2xl overflow-hidden" noHover>
                        <div className="p-6 border-b border-pink-100 flex items-center justify-between bg-white">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Tu pedido</h3>
                                <p className="text-sm text-gray-500 mt-0.5">{carrito.length} {carrito.length === 1 ? 'producto' : 'productos'}</p>
                            </div>
                            <div className="flex gap-2">
                                {carrito.length > 0 && (
                                    <button onClick={() => setMostrarConfirmacion(true)} className="p-2.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Vaciar carrito">
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                )}
                                <button onClick={() => setMostrarCarrito(false)} className="p-2.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
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
                                                    <button onClick={() => quitarDelCarrito(item.producto.id)} className="text-gray-300 hover:text-red-400 p-1 flex-shrink-0">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <p className="text-xs text-gray-500 mb-3">${getPrecioConDescuento(item.producto).toLocaleString()} c/u</p>
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2 bg-white rounded-xl p-1.5 border border-pink-100">
                                                        <button onClick={() => actualizarCantidad(item.producto.id, -1)} className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center text-pink-600 hover:bg-pink-100 transition-colors">
                                                            <Minus className="w-4 h-4" />
                                                        </button>
                                                        <span className="text-sm font-bold w-6 text-center">{item.cantidad}</span>
                                                        <button onClick={() => actualizarCantidad(item.producto.id, 1)} disabled={item.cantidad >= item.producto.stock} className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center text-pink-600 hover:bg-pink-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
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
                                    {/* Cupón */}
                                    {!appliedCoupon ? (
                                        <div className="flex gap-2 mb-4">
                                            <input
                                                type="text"
                                                value={cuponInput}
                                                onChange={(e) => setCuponInput(e.target.value)}
                                                placeholder="Ingresar cupón"
                                                className="form-input flex-1 text-sm py-2.5"
                                            />
                                            <button
                                                type="button"
                                                onClick={aplicarCupon}
                                                className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200 transition-colors"
                                            >
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
                                        onClick={handleWhatsAppClick}
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
                                <button onClick={() => setMostrarCarrito(false)} className="px-6 py-3 rounded-xl bg-pink-500 text-white font-bold hover:bg-pink-600 transition-colors">
                                    Explorar catálogo
                                </button>
                            </div>
                        )}
                    </PastelCard>
                </div>
            )}

            {/* Modal vaciar carrito */}
            {mostrarConfirmacion && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMostrarConfirmacion(false)} />
                    <PastelCard className="w-full max-w-sm p-8 z-50 text-center" noHover>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">¿Vaciar carrito?</h3>
                        <p className="text-gray-500 text-sm mb-6">Se eliminarán todos los productos. Esta acción no se puede deshacer.</p>
                        <div className="flex gap-4">
                            <button onClick={() => setMostrarConfirmacion(false)} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={vaciarCarrito} className="flex-1 py-3 rounded-xl bg-red-50 text-red-600 font-bold hover:bg-red-100 transition-colors">
                                Vaciar
                            </button>
                        </div>
                    </PastelCard>
                </div>
            )}

            {/* Modal imagen */}
            {imagenPrevia && (
                <div className="fixed inset-0 z-[80] bg-black/95 flex items-center justify-center p-4" onClick={() => setImagenPrevia(null)}>
                    <button onClick={() => setImagenPrevia(null)} className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10">
                        <X className="w-6 h-6" />
                    </button>
                    <div className="relative w-full max-w-2xl aspect-square" onClick={e => e.stopPropagation()}>
                        <Image src={imagenPrevia} alt="Vista previa" fill className="object-contain rounded-2xl" />
                    </div>
                </div>
            )}

            {/* Modal easter egg: cupón 10% por única vez */}
            {easterModal.open && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setEasterModal(m => ({ ...m, open: false }))} />
                    <PastelCard className="w-full max-w-sm p-8 z-50 text-center relative" noHover>
                        <button onClick={() => setEasterModal(m => ({ ...m, open: false }))} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                            <X className="w-5 h-5" />
                        </button>
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center mx-auto mb-5">
                            <Sparkles className="w-7 h-7 text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                            {easterModal.alreadyClaimed ? '¡Ya lo habías encontrado!' : '¡Encontraste el easter egg!'}
                        </h3>
                        <p className="text-gray-600 text-sm mb-4">
                            {easterModal.alreadyClaimed
                                ? 'Tu cupón de 10% por única vez (este dispositivo) es:'
                                : 'Tu cupón de 10% por única vez:'}
                        </p>
                        {easterModal.code && (
                            <p className="font-mono text-lg font-bold text-pink-600 bg-pink-50 rounded-xl py-3 px-4 mb-5 select-all">
                                {easterModal.code}
                            </p>
                        )}
                        <p className="text-xs text-gray-500 mb-2">Usalo en el carrito al hacer tu pedido.</p>
                        <button
                            onClick={() => setEasterModal(m => ({ ...m, open: false }))}
                            className="w-full py-3 rounded-xl bg-pink-500 text-white font-bold hover:bg-pink-600 transition-colors"
                        >
                            Cerrar
                        </button>
                    </PastelCard>
                </div>
            )}
        </div>
    )
}
