'use client'

import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import {
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    Plus,
    RefreshCw,
    Search,
    Share2,
    ShoppingBag,
    SlidersHorizontal,
    Sparkles,
} from 'lucide-react'
import { getProductImages } from '@/lib/supabase'
import type { PublicCatalogCombo, PublicCatalogProduct } from '@/lib/domain/catalog/publicDto'
import { getShareAbsoluteUrl } from '@/lib/site'
import { openWhatsApp } from '@/lib/whatsappLink'
import { cartSubtotal, couponDiscountFromPercent, totalAfterCoupon } from '@/lib/catalogPricing'
import { catalogDisplayComboPrice } from '@/lib/domain/payments/catalogDisplayPrice'
import { getCatalogBadgesForProduct } from '@/lib/catalogBadges'
import { formatPesoAR } from '@/lib/formatPesoAR'
import { CatalogPrice } from '@/components/Catalogo/CatalogPrice'
import { useToast } from '@/context/ToastContext'
import { BadgeRotator } from '@/components/Catalogo/BadgeRotator'
import { ImagenComboRotativa } from '@/components/Catalogo/ImagenComboRotativa'
import { ORDEN_DEFAULT, ORDEN_OPTIONS, PRODUCTOS_POR_PAGINA } from '@/components/Catalogo/catalogConstants'
import { useCarrito } from '@/hooks/useCarrito'
import { loadOrderAccess } from '@/lib/domain/payments/publicSession'
import { buildOrderFollowPath } from '@/lib/domain/orders/followLink'
import { useCatalogData, type CatalogInitialSnapshot } from '@/hooks/useCatalogData'
import { useCatalogDerivedLists } from '@/hooks/useCatalogDerivedLists'
import { validarCuponCatalogo } from '@/app/actions/coupons'
import ThemeSwitch from '@/components/ThemeSwitch'
import styles from '@/components/Catalogo/CatalogoEditorial.module.css'

const ModalCarrito = dynamic(
    () => import('@/components/Catalogo/ModalCarrito').then(m => ({ default: m.ModalCarrito })),
    { ssr: false }
)
const ModalConfirmacionVaciar = dynamic(
    () => import('@/components/Catalogo/ModalConfirmacionVaciar').then(m => ({ default: m.ModalConfirmacionVaciar })),
    { ssr: false }
)
const ModalImagenPrevia = dynamic(
    () => import('@/components/gallery/ModalImagenPrevia').then(m => ({ default: m.ModalImagenPrevia })),
    { ssr: false }
)
const CheckoutPedido = dynamic(
    () => import('@/components/Catalogo/CheckoutPedido').then(m => ({ default: m.CheckoutPedido })),
    { ssr: false }
)
const ModalDetalleCombo = dynamic(
    () => import('@/components/Catalogo/ModalDetalleCombo').then(m => ({ default: m.ModalDetalleCombo })),
    { ssr: false }
)

type CatalogoProps = { initialCatalog?: CatalogInitialSnapshot | null }

const HERO_IMAGE = 'https://images.unsplash.com/photo-1679307658813-da95b901ecd9?auto=format&fit=crop&w=1200&q=85'
const RITUAL_IMAGE = 'https://images.unsplash.com/photo-1687716432612-2a46da37a43b?auto=format&fit=crop&w=1200&q=85'

export default function Catalogo({ initialCatalog = null }: CatalogoProps) {
    const { showToast: baseShowToast } = useToast()
    const [mostrarCarrito, setMostrarCarrito] = useState(false)
    const [mostrarCheckout, setMostrarCheckout] = useState(false)
    const [checkoutConfirmado, setCheckoutConfirmado] = useState(false)
    const [ultimoPedido, setUltimoPedido] = useState<{ orderNumber: string; href: string } | null>(null)
    const showToast = useCallback((type: 'success' | 'error' | 'warning' | 'info', message: string) => {
        const action = (type === 'success' && (message.includes('agregado') || message.includes('actualizada')))
            ? { label: 'Ver carrito', onClick: () => setMostrarCarrito(true) }
            : undefined
        baseShowToast(type, message, 4000, action)
    }, [baseShowToast])

    const {
        carrito,
        agregarAlCarrito,
        agregarComboAlCarrito,
        quitarDelCarrito,
        quitarComboDelCarrito,
        actualizarCantidad,
        actualizarCantidadCombo,
        clearCarrito,
        mantenerSoloProductosDisponibles,
        badgeAnimado,
    } = useCarrito(showToast)

    const [categoriaFiltro, setCategoriaFiltro] = useState<string>('all')
    const [busqueda, setBusqueda] = useState('')
    const [precioMin, setPrecioMin] = useState(0)
    const [precioMax, setPrecioMax] = useState(999999)
    const [ordenamiento, setOrdenamiento] = useState(ORDEN_DEFAULT)
    const {
        productos,
        combos,
        categorias,
        cargando,
        catalogLoadError,
        recargarCatalogo,
        ventasPorProducto,
    } = useCatalogData(ordenamiento, initialCatalog)

    const [imagenPrevia, setImagenPrevia] = useState<{ images: string[]; index: number } | null>(null)
    const [indiceImagenPorProducto, setIndiceImagenPorProducto] = useState<Record<number, number>>({})
    const touchSwipeRef = useRef<{ productId: number; x: number; count: number } | null>(null)
    const searchRef = useRef<HTMLInputElement>(null)
    const [comboSeleccionado, setComboSeleccionado] = useState<PublicCatalogCombo | null>(null)
    const [mostrarFiltros, setMostrarFiltros] = useState(false)
    const [ordenSelectOpen, setOrdenSelectOpen] = useState(false)
    const ordenSelectRef = useRef<HTMLDivElement>(null)
    const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)
    const [cuponInput, setCuponInput] = useState('')
    const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount_percentage: number } | null>(null)
    const [paginaActual, setPaginaActual] = useState(1)

    useEffect(() => {
        if (productos.length > 0 && carrito.length > 0) {
            const combosIds = new Set(combos.map(c => c.id))
            mantenerSoloProductosDisponibles(productos, combosIds)
        }
    }, [productos, combos, carrito.length, mantenerSoloProductosDisponibles])

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
    const orderLabel = ORDEN_OPTIONS.find(option => option.value === ordenamiento)?.label ?? ORDEN_OPTIONS[0].label

    /* eslint-disable react-hooks/set-state-in-effect -- el índice depende de los filtros activos */
    useEffect(() => {
        setPaginaActual(1)
    }, [categoriaFiltro, busqueda, precioMin, precioMax, ordenamiento])
    /* eslint-enable react-hooks/set-state-in-effect */

    useEffect(() => {
        if (paginaActual > 1) {
            document.querySelector('#productos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }, [paginaActual])

    useEffect(() => {
        if (!ordenSelectOpen) return
        const handleClick = (event: MouseEvent) => {
            if (ordenSelectRef.current && !ordenSelectRef.current.contains(event.target as Node)) {
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

    useEffect(() => {
        const stored = loadOrderAccess()
        if (!stored?.orderNumber) {
            setUltimoPedido(null)
            return
        }
        setUltimoPedido({
            orderNumber: stored.orderNumber,
            href: stored.followToken
                ? buildOrderFollowPath(stored.orderNumber, stored.followToken)
                : '/pedido',
        })
    }, [checkoutConfirmado, mostrarCheckout])

    const subtotal = cartSubtotal(
        carrito.map(item => ({
            unitPrice: item.producto
                ? getPrecioConDescuento(item.producto)
                : (item.combo ? catalogDisplayComboPrice(item.combo) : 0),
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

    const handleWhatsAppClick = () => {
        if (carrito.length === 0) return
        const lines = [
            '¡Hola! Me gustaría hacer el siguiente pedido:',
            '',
            ...carrito.map(item => {
                const nombre = item.producto ? item.producto.name : item.combo!.name
                const precioUnit = item.producto ? getPrecioConDescuento(item.producto) : catalogDisplayComboPrice(item.combo!)
                return `• ${nombre} x${item.cantidad} - $${formatPesoAR(precioUnit * item.cantidad)}`
            }),
            '',
            ...(appliedCoupon
                ? [`Cupón ${appliedCoupon.code} (-${appliedCoupon.discount_percentage}%)`, `Total: $${formatPesoAR(total)}`]
                : [`Total: $${formatPesoAR(total)}`]),
        ]
        openWhatsApp(lines.join('\n'), false)
    }

    const compartirProducto = (producto: PublicCatalogProduct) => {
        const productUrl = getShareAbsoluteUrl(`/catalogo/p/${producto.id}`)
        openWhatsApp([
            '¡Mirá este producto!',
            '',
            `*${producto.name}*`,
            ...(producto.brand ? [producto.brand] : []),
            `Precio: $${formatPesoAR(getPrecioConDescuento(producto))}`,
            productUrl,
            '',
            '¿Te interesa?',
        ].join('\n'), false)
    }

    const compartirCombo = (combo: PublicCatalogCombo) => {
        openWhatsApp([
            '¡Mirá este combo!',
            '',
            `*${combo.name}*`,
            `Precio: $${formatPesoAR(combo.sale_price)}`,
            '',
            '¿Te interesa?',
        ].join('\n'), false)
    }

    const focusSearch = () => {
        document.querySelector('#productos')?.scrollIntoView({ behavior: 'smooth' })
        window.setTimeout(() => searchRef.current?.focus(), 450)
    }

    const clearFilters = () => {
        setBusqueda('')
        setCategoriaFiltro('all')
        setPrecioMin(0)
        setPrecioMax(999999)
        setOrdenamiento(ORDEN_DEFAULT)
    }

    return (
        <div className={styles.root} suppressHydrationWarning>
            <div className={styles.announcement}>
                <span>Envíos en Neuquén</span>
                <span className={styles.announcementDot} aria-hidden />
                <span className={styles.announcementSecondary}>Pedidos por WhatsApp</span>
            </div>

            <header className={styles.siteHeader}>
                <a className={styles.brand} href="#inicio" aria-label="Ir al inicio">
                    <span className={styles.brandMark}>
                        <Image src="/logo-header.png" alt="" width={344} height={120} priority />
                    </span>
                    <span className={styles.brandCopy}>
                        <strong>Ilara</strong>
                        <small>BEAUTY EDIT</small>
                    </span>
                </a>

                <nav className={styles.desktopNav} aria-label="Navegación del catálogo">
                    <a href="#novedades">Novedades</a>
                    <a href="#productos">Productos</a>
                    <a href="#ritual">Rituales</a>
                </nav>

                <div className={styles.headerActions}>
                    <button className={styles.iconButton} type="button" onClick={focusSearch} aria-label="Buscar productos">
                        <Search size={18} />
                    </button>
                    <span className={styles.themeControl}><ThemeSwitch /></span>
                    {ultimoPedido && (
                        <Link className={styles.loginButton} href={ultimoPedido.href} data-testid="catalog-last-order">
                            Pedido {ultimoPedido.orderNumber}
                        </Link>
                    )}
                    <Link className={styles.loginButton} href="/login">Ingresar</Link>
                    <button
                        className={styles.bagButton}
                        type="button"
                        onClick={() => startTransition(() => setMostrarCarrito(true))}
                        aria-label={carrito.length > 0 ? `Ver bolsa, ${carrito.length} ítems` : 'Ver bolsa'}
                    >
                        <ShoppingBag size={16} />
                        Bolsa
                        <span className={`${styles.bagCount} ${badgeAnimado ? 'animate-bounce' : ''}`}>{carrito.length}</span>
                    </button>
                </div>
            </header>

            <main id="inicio" className={styles.main}>
                <section className={styles.hero} id="novedades" aria-labelledby="catalogo-titulo-principal">
                    <div className={styles.heroCopy}>
                        <p className={styles.eyebrow}>Nueva temporada · Ilara Beauty</p>
                        <h1 id="catalogo-titulo-principal" className={styles.heroTitle}>
                            Tu ritual,<br /><em>tu momento.</em>
                        </h1>
                        <p className={styles.heroLead}>
                            Una selección de maquillaje y skincare elegida para sumar color, textura y un poco de magia a todos los días.
                        </p>
                        <div className={styles.heroActions}>
                            <a className={styles.primaryButton} href="#productos">Explorar colección <span>↘</span></a>
                            <a className={styles.textLink} href="#ritual">Descubrir el ritual <span>→</span></a>
                        </div>
                        <div className={styles.heroProof}>
                            <div className={styles.proofMarks} aria-hidden><span>I</span><span>L</span><span>A</span></div>
                            <p><strong>Elegidos con intención</strong><br />Pedidos simples por WhatsApp</p>
                        </div>
                    </div>

                    <div className={styles.heroVisual} aria-label="Selección editorial de productos de belleza">
                        <figure className={styles.heroMainImage}>
                            <Image
                                src={HERO_IMAGE}
                                alt="Brochas de maquillaje sobre un fondo rosa"
                                fill
                                priority
                                sizes="(max-width: 980px) 88vw, 46vw"
                            />
                            <figcaption className={styles.heroCaption}><span>01</span> La edición rosa</figcaption>
                        </figure>
                        <aside className={styles.floatingNote}>
                            <span aria-hidden>✦</span>
                            <p>Pequeños lujos<br />para todos los días.</p>
                        </aside>
                        <div className={styles.heroOrbit} aria-hidden>ILARA · BEAUTY · NEUQUÉN ·</div>
                    </div>
                </section>

                <section className={styles.marquee} aria-label="Beneficios">
                    <div className={styles.marqueeTrack}>
                        <span>Curaduría independiente</span><i>✦</i><span>Retiro en Neuquén</span><i>✦</i><span>Atención personalizada</span><i>✦</i><span>Combos únicos</span><i>✦</i>
                        <span>Curaduría independiente</span><i>✦</i><span>Retiro en Neuquén</span><i>✦</i><span>Atención personalizada</span><i>✦</i><span>Combos únicos</span><i>✦</i>
                    </div>
                </section>

                <section className={styles.shopSection} id="productos" aria-labelledby="catalogo-productos-titulo">
                    <div className={styles.sectionHeading}>
                        <div>
                            <p className={styles.eyebrow}>La selección Ilara</p>
                            <h2 id="catalogo-productos-titulo">Encontrá tu próximo favorito</h2>
                        </div>
                        <p>Productos elegidos uno por uno,<br />sin abrumarte con opciones.</p>
                    </div>

                    <div className={styles.shopToolbar}>
                        <div className={styles.categoryTabs} role="group" aria-label="Filtrar por categoría">
                            <button
                                className={`${styles.categoryTab} ${categoriaFiltro === 'all' ? styles.categoryTabActive : ''}`}
                                type="button"
                                onClick={() => setCategoriaFiltro('all')}
                                aria-pressed={categoriaFiltro === 'all'}
                            >
                                Todo <sup>{productos.length + combos.length}</sup>
                            </button>
                            {categorias.map(categoria => (
                                <button
                                    key={categoria.id}
                                    className={`${styles.categoryTab} ${categoriaFiltro === categoria.id.toString() ? styles.categoryTabActive : ''}`}
                                    type="button"
                                    onClick={() => setCategoriaFiltro(categoria.id.toString())}
                                    aria-pressed={categoriaFiltro === categoria.id.toString()}
                                >
                                    {categoria.name} <sup>{productos.filter(producto => producto.category_id === categoria.id).length}</sup>
                                </button>
                            ))}
                        </div>

                        <label className={styles.searchField}>
                            <Search size={17} aria-hidden />
                            <input
                                ref={searchRef}
                                type="search"
                                placeholder="Buscar producto"
                                value={busqueda}
                                onChange={event => setBusqueda(event.target.value)}
                                aria-label="Buscar productos por nombre o marca"
                                suppressHydrationWarning
                            />
                        </label>

                        <button
                            className={`${styles.filterButton} ${mostrarFiltros ? styles.filterButtonActive : ''}`}
                            type="button"
                            onClick={() => setMostrarFiltros(value => !value)}
                            aria-expanded={mostrarFiltros}
                        >
                            Filtros <SlidersHorizontal size={16} />
                        </button>

                        <div className={styles.orderWrap} ref={ordenSelectRef}>
                            <button
                                className={styles.orderButton}
                                type="button"
                                onClick={() => setOrdenSelectOpen(value => !value)}
                                aria-haspopup="listbox"
                                aria-expanded={ordenSelectOpen}
                                aria-label={`Ordenar por: ${orderLabel}`}
                            >
                                Ordenar <ArrowUpDown size={15} />
                            </button>
                            {ordenSelectOpen && (
                                <div className={styles.orderMenu} role="listbox" aria-label="Ordenar productos">
                                    {ORDEN_OPTIONS.map(option => (
                                        <button
                                            key={option.value}
                                            className={`${styles.orderOption} ${ordenamiento === option.value ? styles.orderOptionActive : ''}`}
                                            type="button"
                                            role="option"
                                            aria-selected={ordenamiento === option.value}
                                            onClick={() => {
                                                setOrdenamiento(option.value)
                                                setOrdenSelectOpen(false)
                                            }}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {mostrarFiltros && (
                        <div className={styles.filterPanel}>
                            <label>
                                Precio mínimo
                                <input type="number" value={precioMin} min={0} onChange={event => setPrecioMin(Number(event.target.value))} />
                            </label>
                            <label>
                                Precio máximo
                                <input type="number" value={precioMax} min={0} onChange={event => setPrecioMax(Number(event.target.value))} />
                            </label>
                            <button className={styles.clearButton} type="button" onClick={clearFilters}>Limpiar filtros</button>
                        </div>
                    )}

                    {cargando ? (
                        <div className={styles.statePanel}>
                            <div className={styles.spinner} aria-hidden />
                            <p>Cargando la selección Ilara…</p>
                        </div>
                    ) : catalogLoadError ? (
                        <div className={styles.statePanel}>
                            <RefreshCw className={styles.stateIcon} size={32} />
                            <h3>No pudimos cargar el catálogo</h3>
                            <p>Puede ser un problema de conexión. Probá de nuevo en unos segundos.</p>
                            <button className={styles.clearButton} type="button" onClick={() => void recargarCatalogo()}>Reintentar</button>
                        </div>
                    ) : totalItems > 0 ? (
                        <>
                            <div className={styles.productGrid}>
                                {itemsPagina.map((item, slotIndex) => {
                                    const esPrioridadLcp = slotIndex < 4
                                    const esCombo = 'combo_items' in item

                                    if (esCombo) {
                                        const combo = item as PublicCatalogCombo
                                        const disponible = comboDisponible(combo)
                                        return (
                                            <article key={`combo-${combo.id}`} className={`${styles.productCard} group content-visibility-auto`}>
                                                <div
                                                    className={styles.productMedia}
                                                    onClick={() => startTransition(() => setComboSeleccionado(combo))}
                                                >
                                                    <ImagenComboRotativa
                                                        combo={combo}
                                                        fill
                                                        className="absolute inset-0 h-full w-full"
                                                        sizes="(max-width: 680px) 50vw, (max-width: 980px) 33vw, 25vw"
                                                        priority={esPrioridadLcp}
                                                    />
                                                    <span className={styles.comboBadge}>Combo</span>
                                                    <button
                                                        className={styles.shareButton}
                                                        type="button"
                                                        onClick={event => { event.stopPropagation(); compartirCombo(combo) }}
                                                        aria-label={`Compartir ${combo.name}`}
                                                    >
                                                        <Share2 size={16} />
                                                    </button>
                                                    <button
                                                        className={styles.quickAdd}
                                                        type="button"
                                                        disabled={!disponible}
                                                        onClick={event => {
                                                            event.stopPropagation()
                                                            if (disponible) startTransition(() => agregarComboAlCarrito(combo))
                                                        }}
                                                    >
                                                        {disponible ? 'Agregar' : 'Agotado'} <Plus size={17} />
                                                    </button>
                                                </div>
                                                <div className={styles.productInfo}>
                                                    <span className={styles.productCategory}>Combo Ilara</span>
                                                    <button
                                                        type="button"
                                                        className={styles.productName}
                                                        onClick={() => startTransition(() => setComboSeleccionado(combo))}
                                                    >
                                                        {combo.name}
                                                    </button>
                                                    <CatalogPrice
                                                        className={styles.price}
                                                        amount={combo.sale_price}
                                                        dual={combo.dual_price_visible === true}
                                                        publicAmount={combo.public_price}
                                                        transferAmount={combo.transfer_price}
                                                    />
                                                    {combo.description && <p className={styles.productBrand}>{combo.description}</p>}
                                                </div>
                                            </article>
                                        )
                                    }

                                    const producto = item as PublicCatalogProduct
                                    const badges = getCatalogBadgesForProduct(producto)
                                    const images = getProductImages(producto)
                                    const idx = indiceImagenPorProducto[producto.id] ?? 0
                                    const currentImage = images[idx]
                                    const setIdx = (delta: number) => {
                                        const next = (idx + delta + images.length) % images.length
                                        setIndiceImagenPorProducto(previous => ({ ...previous, [producto.id]: next }))
                                    }

                                    return (
                                        <article key={`producto-${producto.id}`} className={`${styles.productCard} group content-visibility-auto`}>
                                            <div
                                                className={styles.productMedia}
                                                onClick={() => startTransition(() => {
                                                    if (images.length > 0) setImagenPrevia({ images, index: idx })
                                                })}
                                                onTouchStart={event => {
                                                    if (images.length > 1) {
                                                        touchSwipeRef.current = { productId: producto.id, x: event.targetTouches[0].clientX, count: images.length }
                                                    }
                                                }}
                                                onTouchEnd={event => {
                                                    const ref = touchSwipeRef.current
                                                    if (!ref || ref.productId !== producto.id) return
                                                    const delta = ref.x - event.changedTouches[0].clientX
                                                    if (Math.abs(delta) > 50) {
                                                        const direction = delta > 0 ? 1 : -1
                                                        setIndiceImagenPorProducto(previous => {
                                                            const current = previous[ref.productId] ?? 0
                                                            return { ...previous, [ref.productId]: (current + direction + ref.count) % ref.count }
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
                                                        sizes="(max-width: 680px) 50vw, (max-width: 980px) 33vw, 25vw"
                                                        priority={esPrioridadLcp}
                                                        loading={esPrioridadLcp ? 'eager' : undefined}
                                                    />
                                                ) : (
                                                    <div
                                                        className={styles.mediaPlaceholder}
                                                        role="img"
                                                        aria-label={`${producto.name}, sin imagen`}
                                                    />
                                                )}

                                                {images.length > 1 && (
                                                    <>
                                                        <button
                                                            className={`${styles.imageArrow} ${styles.imageArrowLeft}`}
                                                            type="button"
                                                            onClick={event => { event.stopPropagation(); setIdx(-1) }}
                                                            aria-label={`Imagen anterior de ${producto.name}`}
                                                        >
                                                            <ChevronLeft size={17} />
                                                        </button>
                                                        <button
                                                            className={`${styles.imageArrow} ${styles.imageArrowRight}`}
                                                            type="button"
                                                            onClick={event => { event.stopPropagation(); setIdx(1) }}
                                                            aria-label={`Imagen siguiente de ${producto.name}`}
                                                        >
                                                            <ChevronRight size={17} />
                                                        </button>
                                                        <div className={styles.imageDots} aria-hidden>
                                                            {images.map((_, imageIndex) => (
                                                                <span key={imageIndex} className={imageIndex === idx ? styles.imageDotActive : styles.imageDot} />
                                                            ))}
                                                        </div>
                                                    </>
                                                )}

                                                {badges.length > 0 && <BadgeRotator badges={badges} />}
                                                <button
                                                    className={styles.shareButton}
                                                    type="button"
                                                    onClick={event => { event.stopPropagation(); compartirProducto(producto) }}
                                                    aria-label={`Compartir ${producto.name}`}
                                                >
                                                    <Share2 size={16} />
                                                </button>
                                                <button
                                                    className={styles.quickAdd}
                                                    type="button"
                                                    disabled={producto.stock === 0}
                                                    onClick={event => {
                                                        event.stopPropagation()
                                                        if (producto.stock > 0) startTransition(() => agregarAlCarrito(producto))
                                                    }}
                                                >
                                                    {producto.stock > 0 ? 'Agregar' : 'Agotado'} <Plus size={17} />
                                                </button>
                                            </div>
                                            <div className={styles.productInfo}>
                                                <span className={styles.productCategory}>{producto.categories?.name ?? 'Belleza'}</span>
                                                <Link className={styles.productName} href={`/catalogo/p/${producto.id}`}>{producto.name}</Link>
                                                <CatalogPrice
                                                    className={styles.price}
                                                    amount={getPrecioConDescuento(producto)}
                                                    listAmount={producto.sale_price}
                                                    dual={producto.dual_price_visible === true}
                                                    publicAmount={producto.public_price}
                                                    transferAmount={producto.transfer_price ?? getPrecioConDescuento(producto)}
                                                />
                                                {producto.brand && <p className={styles.productBrand}>{producto.brand}</p>}
                                            </div>
                                        </article>
                                    )
                                })}
                            </div>

                            {totalPaginas > 1 && (
                                <nav className={styles.pagination} aria-label="Paginación del catálogo">
                                    <span>Mostrando {inicio + 1}–{Math.min(inicio + PRODUCTOS_POR_PAGINA, totalItems)} de {totalItems}</span>
                                    <div className={styles.pageButtons}>
                                        <button className={styles.pageButton} type="button" disabled={paginaActual === 1} onClick={() => setPaginaActual(page => Math.max(1, page - 1))} aria-label="Página anterior">
                                            <ChevronLeft size={17} />
                                        </button>
                                        {Array.from({ length: totalPaginas }, (_, index) => index + 1).map(page => (
                                            <button
                                                key={page}
                                                className={page === paginaActual ? styles.pageButtonActive : styles.pageButton}
                                                type="button"
                                                onClick={() => setPaginaActual(page)}
                                                aria-current={page === paginaActual ? 'page' : undefined}
                                                aria-label={`Página ${page}`}
                                            >
                                                {page}
                                            </button>
                                        ))}
                                        <button className={styles.pageButton} type="button" disabled={paginaActual === totalPaginas} onClick={() => setPaginaActual(page => Math.min(totalPaginas, page + 1))} aria-label="Página siguiente">
                                            <ChevronRight size={17} />
                                        </button>
                                    </div>
                                </nav>
                            )}
                        </>
                    ) : (
                        <div className={styles.statePanel}>
                            <Sparkles className={styles.stateIcon} size={34} />
                            <h3>No encontramos ese producto</h3>
                            <p>Probá con otra búsqueda o recorré todas las categorías.</p>
                            <button className={styles.clearButton} type="button" onClick={clearFilters}>Ver todo el catálogo</button>
                        </div>
                    )}
                </section>

                <section className={styles.ritualBanner} id="ritual">
                    <div className={styles.ritualCopy}>
                        <p className={styles.eyebrow}>Ilara Journal · 01</p>
                        <h2>Un momento para vos,<br />antes de salir al mundo.</h2>
                        <p>Tres pasos, cinco minutos y productos que se sienten tan bien como se ven.</p>
                        <a href="#productos">Armar mi ritual <span>→</span></a>
                    </div>
                    <div className={styles.ritualImage}>
                        <Image src={RITUAL_IMAGE} alt="Brochas y flores sobre un fondo rosa" fill sizes="(max-width: 980px) 100vw, 55vw" />
                        <span className={styles.ritualStamp}>05<br /><small>MINUTOS</small></span>
                    </div>
                </section>
            </main>

            <footer className={styles.footer}>
                <div className={styles.footerBrand}>
                    <strong>Ilara</strong>
                    <p>Belleza elegida con intención.<br />Neuquén, Argentina.</p>
                </div>
                <div className={styles.footerLinks}>
                    <small>DESCUBRÍ</small>
                    <a href="#productos">Productos</a>
                    <a href="#ritual">Sets y rituales</a>
                    <a href="#novedades">Novedades</a>
                </div>
                <div className={styles.footerLinks}>
                    <small>HABLEMOS</small>
                    <button type="button" onClick={() => openWhatsApp('¡Hola! Quiero hacer una consulta sobre el catálogo de Ilara.', false)}>WhatsApp</button>
                    <Link href="/login">Ingresar</Link>
                </div>
                <p className={styles.footerNote}>© {new Date().getFullYear()} Ilara Beauty · Neuquén</p>
            </footer>

            {carrito.length > 0 && !mostrarCarrito && (
                <button
                    className={styles.floatingCart}
                    type="button"
                    onClick={() => startTransition(() => setMostrarCarrito(true))}
                    aria-label={`Abrir bolsa, ${carrito.length} ítems, total ${formatPesoAR(total)} pesos`}
                >
                    <span>Bolsa</span>
                    <b>{carrito.length}</b>
                    <i>${formatPesoAR(total)}</i>
                </button>
            )}

            <ModalCarrito
                open={mostrarCarrito && !mostrarCheckout}
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
                quitarCupon={() => setAppliedCoupon(null)}
                subtotal={subtotal}
                descuentoCupon={descuentoCupon}
                total={total}
                onWhatsApp={handleWhatsAppClick}
                onCheckout={() => {
                    setMostrarCarrito(false)
                    setMostrarCheckout(true)
                }}
                onSolicitarVaciar={() => setMostrarConfirmacion(true)}
            />

            {mostrarCheckout && (
                <CheckoutPedido
                    open
                    onClose={() => {
                        setMostrarCheckout(false)
                        if (checkoutConfirmado) {
                            clearCarrito()
                            setAppliedCoupon(null)
                            setCheckoutConfirmado(false)
                        }
                    }}
                    onBack={() => {
                        setMostrarCheckout(false)
                        setMostrarCarrito(true)
                    }}
                    carrito={carrito}
                    appliedCoupon={appliedCoupon}
                    subtotal={subtotal}
                    descuentoCupon={descuentoCupon}
                    total={total}
                    showToast={showToast}
                    onOrderCreated={() => {
                        setCheckoutConfirmado(true)
                    }}
                />
            )}

            <ModalConfirmacionVaciar open={mostrarConfirmacion} onClose={() => setMostrarConfirmacion(false)} onConfirm={vaciarCarrito} />

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
