'use client'

import { useCallback, useContext, useState, startTransition } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { Producto, getProductImages } from '@/lib/supabase'
import {
  cartSubtotal,
  couponDiscountFromPercent,
  priceWithProductDiscount,
  totalAfterCoupon,
} from '@/lib/catalogPricing'
import { validarCuponCatalogo } from '@/app/actions/coupons'
import { formatPesoAR } from '@/lib/formatPesoAR'
import { getShareAbsoluteUrl } from '@/lib/site'
import { openWhatsApp } from '@/lib/whatsappLink'
import { useCarrito } from '@/hooks/useCarrito'
import { ToastContext } from '@/context/ToastContext'
import ThemeSwitch from '@/components/ThemeSwitch'
import { ProductRelatedTile } from './ProductRelatedTile'
import {
  ChevronLeft,
  ChevronRight,
  Share2,
  ShoppingBag,
  Sparkles,
  MessageCircle,
  Package,
  Truck,
} from 'lucide-react'

const ModalImagenPrevia = dynamic(
  () => import('@/components/gallery/ModalImagenPrevia').then(m => ({ default: m.ModalImagenPrevia })),
  { ssr: false }
)
const ModalCarrito = dynamic(
  () => import('@/components/Catalogo/ModalCarrito').then(m => ({ default: m.ModalCarrito })),
  { ssr: false }
)
const ModalConfirmacionVaciar = dynamic(
  () => import('@/components/Catalogo/ModalConfirmacionVaciar').then(m => ({ default: m.ModalConfirmacionVaciar })),
  { ssr: false }
)

/** Misma plantilla en `lg+` que la grilla del producto: migas y columnas comparten ejes. */
const PDP_LG_TWO_COL = 'lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12 xl:gap-14'

type Props = {
  producto: Producto
  canonicalPath: string
  relatedProducts?: Producto[]
}

export function ProductPublicDetailClient({ producto, canonicalPath, relatedProducts = [] }: Props) {
  const toastCtx = useContext(ToastContext)
  const showToast = useCallback(
    (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
      toastCtx?.showToast(type, message, 4000)
    },
    [toastCtx]
  )
  const {
    carrito,
    agregarAlCarrito,
    clearCarrito,
    quitarDelCarrito,
    quitarComboDelCarrito,
    actualizarCantidad,
    actualizarCantidadCombo,
  } = useCarrito(showToast)

  const images = getProductImages(producto)
  const [activeIdx, setActiveIdx] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [mostrarCarrito, setMostrarCarrito] = useState(false)
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)
  const [cuponInput, setCuponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string
    discount_percentage: number
  } | null>(null)

  const getPrecioConDescuento = useCallback(
    (p: Producto) => priceWithProductDiscount(p.sale_price, p.discount_percentage),
    []
  )

  const subtotal = cartSubtotal(
    carrito.map(item => ({
      unitPrice: item.producto ? getPrecioConDescuento(item.producto) : (item.combo?.sale_price ?? 0),
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

  const quitarCupon = () => setAppliedCoupon(null)

  const handleCarritoWhatsApp = () => {
    if (carrito.length === 0) return
    const lines = [
      '¡Hola! Me gustaría hacer el siguiente pedido:',
      '',
      ...carrito.map(item => {
        const nombre = item.producto ? item.producto.name : item.combo!.name
        const precioUnit = item.producto ? getPrecioConDescuento(item.producto) : item.combo!.sale_price
        return `• ${nombre} x${item.cantidad} - $${formatPesoAR(precioUnit * item.cantidad)}`
      }),
      '',
      ...(appliedCoupon
        ? [
            `Cupón ${appliedCoupon.code} (-${appliedCoupon.discount_percentage}%)`,
            `Total: $${formatPesoAR(total)}`,
          ]
        : [`Total: $${formatPesoAR(total)}`]),
    ]
    if (!openWhatsApp(lines.join('\n'), false)) {
      showToast('error', 'No se pudo generar el enlace de WhatsApp')
    }
  }

  const vaciarCarritoYcerrar = () => {
    clearCarrito()
    setAppliedCoupon(null)
    setMostrarCarrito(false)
    setMostrarConfirmacion(false)
    showToast('info', 'Carrito vaciado')
  }

  const mainSrc = images[activeIdx]
  const isPrimaryLcpImage = activeIdx === 0
  const precio = priceWithProductDiscount(producto.sale_price, producto.discount_percentage)

  const compartir = () => {
    const link = getShareAbsoluteUrl(canonicalPath)
    const partes = [
      '¡Mirá este producto!',
      '',
      `*${producto.name}*`,
      ...(producto.brand ? [producto.brand] : []),
      `Precio: $${formatPesoAR(precio)}`,
      link,
    ]
    // Misma pestaña: en PC Chrome suele bloquear `target=_blank` programático; el pedido ya usa assign.
    if (!openWhatsApp(partes.join('\n'), false)) {
      showToast('error', 'No se pudo generar el enlace de WhatsApp')
    }
  }

  const consultarWhatsApp = () => {
    const link = getShareAbsoluteUrl(canonicalPath)
    const lineas = [
      '¡Hola! Consulto por este producto:',
      '',
      `*${producto.name}*`,
      ...(producto.brand ? [producto.brand] : []),
      `Precio: $${formatPesoAR(precio)}`,
      link,
    ]
    if (!openWhatsApp(lineas.join('\n'), false)) {
      showToast('error', 'No se pudo generar el enlace de WhatsApp')
    }
  }

  const stockAgotado = producto.stock <= 0
  const stockBajo = !stockAgotado && producto.stock <= producto.min_stock

  const goThumb = (delta: number) => {
    if (images.length === 0) return
    setActiveIdx(i => (i + delta + images.length) % images.length)
  }

  const colorDetalle = producto.color?.trim()

  /**
   * Altura mínima en px para el visor: evita colapso cuando solo hay hijos absolute (fill).
   * Inline = siempre aplica; no depende de utilidades Tailwind arbitrarias.
   */
  const galleryMinHeight = 320

  return (
    <div className="ilara-pdp min-h-screen w-full min-w-0 overflow-x-hidden bg-zinc-50 text-gray-900 dark:text-gray-100">
      <header className="ilara-pdp-header sticky top-0 z-40 border-b border-pink-200/50 bg-white/95 backdrop-blur-sm">
        <div className="ilara-pdp-shell flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10 xl:px-12">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <Link
              href="/catalogo"
              className="inline-flex items-center gap-2 text-sm font-semibold text-pink-600 dark:text-pink-400 hover:underline min-w-0 shrink-0"
            >
              <ChevronLeft className="w-5 h-5 shrink-0" aria-hidden />
              <span className="hidden min-[400px]:inline truncate">Catálogo</span>
            </Link>
            <span className="h-6 w-px bg-pink-200 dark:bg-zinc-600 shrink-0 hidden sm:block" aria-hidden />
            <Link
              href="/"
              className="hidden sm:flex items-center gap-2.5 min-w-0 text-gray-800 dark:text-gray-100 hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
            >
              <div className="h-9 w-[100px] rounded-xl overflow-hidden border border-pink-100 dark:border-zinc-600 shrink-0 bg-white dark:bg-zinc-900 flex items-center justify-center px-1">
                <Image
                  src="/logo-header.png"
                  alt="Ilara Beauty"
                  width={200}
                  height={70}
                  className="object-contain w-full h-full max-h-full"
                  sizes="100px"
                />
              </div>
              <span className="text-sm font-bold tracking-tight truncate">Ilara Beauty</span>
            </Link>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeSwitch />
            <Link
              href="/catalogo"
              className="p-2.5 rounded-xl bg-pink-50 dark:bg-zinc-800 hover:bg-pink-100 dark:hover:bg-zinc-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
              aria-label="Ir al catálogo y carrito"
            >
              <ShoppingBag className="w-5 h-5 text-pink-600 dark:text-pink-400" />
            </Link>
            <Link
              href="/login"
              className="px-3.5 py-2 rounded-xl border border-pink-200 dark:border-zinc-600 text-gray-600 dark:text-gray-200 font-semibold text-sm hover:border-pink-300 dark:hover:border-zinc-500 transition-colors"
            >
              Login
            </Link>
          </div>
        </div>
      </header>

      <main className="w-full min-w-0 pt-8 sm:pt-10 lg:pt-12 pb-32 lg:pb-40">
        <div className="ilara-pdp-shell min-w-0 px-4 sm:px-6 lg:px-10 xl:px-12">
        <div
          className={`mb-12 grid w-full min-w-0 grid-cols-1 lg:mb-16 ${PDP_LG_TWO_COL}`}
        >
          <nav
            className="ilara-pdp-breadcrumbs min-w-0 text-sm leading-relaxed text-gray-500 dark:text-zinc-400"
            aria-label="Migas de pan"
          >
            <ol className="flex flex-wrap items-baseline gap-x-2.5 gap-y-2">
              <li className="shrink-0">
                <Link
                  href="/"
                  className="font-medium text-gray-600 transition-colors hover:text-pink-600 dark:text-zinc-300 dark:hover:text-pink-400"
                >
                  Inicio
                </Link>
              </li>
              <li className="flex shrink-0 items-center text-gray-400 dark:text-zinc-500" aria-hidden>
                <ChevronRight className="w-3.5 h-3.5" />
              </li>
              <li className="shrink-0">
                <Link
                  href="/catalogo"
                  className="font-medium text-gray-600 transition-colors hover:text-pink-600 dark:text-zinc-300 dark:hover:text-pink-400"
                >
                  Catálogo
                </Link>
              </li>
              <li className="flex shrink-0 items-center text-gray-400 dark:text-zinc-500" aria-hidden>
                <ChevronRight className="w-3.5 h-3.5" />
              </li>
              <li className="min-w-0 w-full max-w-full sm:w-auto sm:max-w-none" aria-current="page">
                <span className="block line-clamp-2 font-semibold leading-snug text-gray-900 dark:text-zinc-100 sm:inline sm:max-w-md sm:truncate sm:line-clamp-none">
                  {producto.name}
                </span>
              </li>
            </ol>
          </nav>
          <div className="hidden min-w-0 lg:block" aria-hidden />
        </div>

        <div
          className={`grid w-full min-w-0 grid-cols-1 items-stretch gap-10 ${PDP_LG_TWO_COL}`}
        >
          {/* Galería: altura por estilo inline + imagen en flujo (no solo fill sin altura de bloque) */}
          <div className="w-full min-w-0 space-y-4">
            <div
              className="ilara-pdp-gallery-frame relative w-full overflow-hidden rounded-2xl bg-zinc-200 ring-1 ring-black/10 shadow-lg dark:ring-white/10 dark:shadow-black/40"
              style={{
                minHeight: galleryMinHeight,
                maxHeight: 'min(85vh, 720px)',
              }}
            >
              {mainSrc ? (
                <>
                  <button
                    type="button"
                    className="relative z-0 block w-full cursor-zoom-in text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                    onClick={() => startTransition(() => setModalOpen(true))}
                    aria-label={`Ampliar imagen de ${producto.name}`}
                  >
                    {/* width/height intrínsecos: ocupa espacio en el flujo aunque el contenedor tenga minHeight */}
                    <Image
                      src={mainSrc}
                      alt={producto.name}
                      width={1200}
                      height={1200}
                      className="w-full h-auto object-cover"
                      style={{ maxHeight: 'min(85vh, 720px)' }}
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      priority={isPrimaryLcpImage}
                      loading={isPrimaryLcpImage ? 'eager' : undefined}
                    />
                  </button>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/20 to-transparent dark:from-black/40" aria-hidden />
                </>
              ) : (
                <div
                  className="flex min-h-[320px] w-full flex-col items-center justify-center gap-3 text-pink-200 dark:text-pink-500/40"
                  style={{ minHeight: galleryMinHeight }}
                >
                  <Sparkles className="w-20 h-20" aria-hidden />
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Sin imagen</span>
                </div>
              )}

              {mainSrc && (
                <div className="absolute top-3 right-3 z-20 sm:top-4 sm:right-4">
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      compartir()
                    }}
                    className="rounded-xl bg-white/95 p-2.5 text-gray-800 shadow-md ring-1 ring-black/5 dark:bg-zinc-900/95 dark:text-gray-100 dark:ring-white/10 hover:text-pink-600 dark:hover:text-pink-400"
                    aria-label={`Compartir ${producto.name}`}
                  >
                    <Share2 className="h-5 w-5" strokeWidth={2.25} />
                  </button>
                </div>
              )}

              {images.length > 1 && mainSrc && (
                <>
                  <button
                    type="button"
                    onClick={() => goThumb(-1)}
                    className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/95 p-2.5 shadow-md dark:bg-zinc-900/95 sm:flex"
                    aria-label="Imagen anterior"
                  >
                    <ChevronLeft className="h-5 w-5 text-gray-800 dark:text-gray-100" />
                  </button>
                  <button
                    type="button"
                    onClick={() => goThumb(1)}
                    className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/95 p-2.5 shadow-md dark:bg-zinc-900/95 sm:flex"
                    aria-label="Imagen siguiente"
                  >
                    <ChevronRight className="h-5 w-5 text-gray-800 dark:text-gray-100" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 z-10 flex max-w-[90%] -translate-x-1/2 gap-2 overflow-x-auto rounded-full bg-black/50 px-3 py-2 dark:bg-black/60">
                    {images.map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 shrink-0 rounded-full ${i === activeIdx ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`}
                        aria-hidden
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 touch-pan-x overscroll-x-contain">
                {images.map((src, i) => (
                  <button
                    key={`${src}-${i}`}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl ring-2 transition-all sm:h-24 sm:w-24 ${
                      i === activeIdx
                        ? 'ring-pink-500 dark:ring-pink-400'
                        : 'ring-transparent opacity-80 hover:opacity-100 hover:ring-zinc-300 dark:hover:ring-zinc-600'
                    }`}
                    aria-label={`Ver imagen ${i + 1} de ${images.length}`}
                    aria-current={i === activeIdx ? 'true' : undefined}
                  >
                    <Image src={src} alt="" width={160} height={160} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex h-full min-h-0 w-full flex-col gap-8 lg:sticky lg:top-28">
            <div className="ilara-pdp-surface flex min-h-0 flex-1 flex-col rounded-2xl border border-pink-100 bg-white px-8 pb-10 pt-9 shadow-sm sm:px-10 sm:pb-11 sm:pt-10 lg:px-11 lg:pb-12 lg:pt-7">
              <div className="flex min-h-0 flex-1 flex-col gap-7 sm:gap-8">
                {/* 1 · Identidad + disponibilidad */}
                <header className="flex flex-col gap-4 sm:gap-5">
                  {producto.categories?.name && (
                    <p className="text-xs font-bold uppercase tracking-widest text-pink-600 dark:text-pink-400">
                      {producto.categories.name}
                    </p>
                  )}
                  <div className="flex flex-col gap-3">
                    <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-gray-900 dark:text-zinc-50 sm:text-4xl">
                      {producto.name}
                    </h1>
                    {producto.brand && (
                      <p className="text-lg leading-snug text-gray-600 dark:text-zinc-400 sm:text-xl">
                        {producto.brand}
                      </p>
                    )}
                  </div>
                  <div
                    className={`inline-flex w-fit max-w-full items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold ${
                      stockAgotado
                        ? 'bg-zinc-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400'
                        : stockBajo
                          ? 'border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100'
                          : 'border border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
                    }`}
                    role="status"
                  >
                    <Package className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    {stockAgotado
                      ? 'Sin stock'
                      : stockBajo
                        ? `Últimas unidades · ${producto.stock}`
                        : `En stock · ${producto.stock} disponibles`}
                  </div>
                </header>

                {producto.notes && (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400">
                      Descripción
                    </p>
                    <p className="text-base leading-relaxed text-gray-700 dark:text-zinc-300 whitespace-pre-wrap">
                      {producto.notes}
                    </p>
                  </div>
                )}

                {/* Precio + acciones: unidad comercial compacta */}
                <div className="flex flex-col gap-5 sm:gap-6">
                  <section aria-labelledby="pdp-precio-heading" className="flex flex-col">
                    <h2 id="pdp-precio-heading" className="sr-only">
                      Precio
                    </h2>
                    <div
                      className="ilara-pdp-price-panel ilara-pdp-surface--muted rounded-xl border border-pink-100 bg-pink-50/50 px-5 py-4 sm:px-6 sm:py-5"
                      role="group"
                      aria-label="Precio de venta"
                    >
                      {(producto.discount_percentage ?? 0) > 0 ? (
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-base font-medium tabular-nums text-gray-400 line-through dark:text-zinc-500">
                              ${formatPesoAR(producto.sale_price)}
                            </span>
                            <span className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-bold uppercase text-white dark:bg-emerald-500">
                              −{producto.discount_percentage}%
                            </span>
                          </div>
                          <div className="flex flex-wrap items-baseline gap-x-1.5 text-gray-900 dark:text-white">
                            <span className="text-2xl font-bold tabular-nums tracking-tight text-pink-700 dark:text-pink-300 sm:text-3xl">
                              $
                            </span>
                            <span className="text-4xl font-extrabold tabular-nums tracking-tight sm:text-5xl lg:text-6xl">
                              {formatPesoAR(precio)}
                            </span>
                          </div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-pink-200/70">
                            Precio actual
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex flex-wrap items-baseline gap-x-1.5 text-gray-900 dark:text-white">
                            <span className="text-2xl font-bold tabular-nums tracking-tight text-pink-700 dark:text-pink-300 sm:text-3xl">
                              $
                            </span>
                            <span className="text-4xl font-extrabold tabular-nums tracking-tight sm:text-5xl lg:text-6xl">
                              {formatPesoAR(precio)}
                            </span>
                          </div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-pink-200/70">
                            Precio
                          </p>
                        </div>
                      )}
                    </div>
                  </section>

                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      disabled={stockAgotado}
                      onClick={() => agregarAlCarrito(producto)}
                      className="w-full min-h-14 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 px-6 py-4 text-base font-bold text-white shadow-md transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 sm:text-lg dark:from-pink-600 dark:to-rose-600"
                    >
                      {stockAgotado ? 'Agotado' : 'Agregar al carrito'}
                    </button>
                    <button
                      type="button"
                      onClick={consultarWhatsApp}
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-pink-300 bg-white px-6 py-3.5 text-sm font-semibold text-pink-800 transition hover:bg-pink-50 dark:border-pink-300/45 dark:bg-transparent dark:text-pink-200 dark:hover:bg-pink-950/25 sm:text-base"
                    >
                      <MessageCircle className="h-5 w-5 shrink-0 opacity-90" aria-hidden strokeWidth={2.25} />
                      Consultar por WhatsApp
                    </button>
                  </div>
                </div>

                <footer className="mt-auto border-t border-pink-100 pt-6 dark:border-zinc-500/25 sm:pt-7">
                  <div className="space-y-3 text-sm leading-relaxed text-gray-600 dark:text-zinc-300">
                    <p className="flex items-start gap-3">
                      <Truck className="mt-0.5 h-4 w-4 shrink-0 text-pink-500 dark:text-pink-400" aria-hidden />
                      <span className="min-w-0">
                        Coordinamos tu pedido por WhatsApp. Retiro a coordinar o envío sin cargo; plazos orientativos
                        1 a 7 días hábiles según disponibilidad.
                      </span>
                    </p>
                    <p className="border-t border-pink-100/80 pt-3 text-xs sm:text-sm dark:border-zinc-500/20">
                      Cambios y devoluciones: hasta <strong className="font-semibold text-gray-800 dark:text-zinc-200">3 días</strong>{' '}
                      con producto sin uso y comprobante; coordinando por WhatsApp. Sin cargo por devolución en las
                      condiciones acordadas.
                    </p>
                  </div>
                </footer>
              </div>
            </div>

            {colorDetalle && (
              <section className="ilara-pdp-surface rounded-2xl border border-pink-100 bg-white px-7 py-8 sm:px-10 sm:py-9">
                <h2 className="mb-5 text-lg font-bold text-gray-900 dark:text-white">Detalles</h2>
                <dl>
                  <div className="flex justify-between gap-6 py-1">
                    <dt className="shrink-0 text-sm font-medium text-gray-500 dark:text-gray-400">Color / tono</dt>
                    <dd className="text-right text-sm font-semibold text-gray-900 dark:text-gray-100 sm:text-base">
                      {colorDetalle}
                    </dd>
                  </div>
                </dl>
              </section>
            )}
          </div>
        </div>

        {relatedProducts.length > 0 && (
          <section className="ilara-pdp-related-section mt-20 border-t border-pink-100 pt-14 lg:mt-24 lg:pt-16">
            <div className="mb-9 flex flex-col justify-between gap-4 sm:mb-10 sm:flex-row sm:items-end">
              <div className="min-w-0 space-y-2">
                <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white sm:text-3xl">
                  También te puede interesar
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 sm:text-base">
                  Más productos de Ilara Beauty
                </p>
              </div>
              <Link
                href="/catalogo"
                className="inline-flex shrink-0 items-center gap-1 self-start text-sm font-bold text-pink-600 hover:text-pink-700 dark:text-pink-400 dark:hover:text-pink-300 sm:self-auto"
              >
                Ver todo el catálogo
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 sm:gap-5 lg:gap-6">
              {relatedProducts.map(rel => (
                <ProductRelatedTile
                  key={rel.id}
                  product={rel}
                  displayPrice={priceWithProductDiscount(rel.sale_price, rel.discount_percentage)}
                />
              ))}
            </div>
          </section>
        )}
        </div>
      </main>

      {modalOpen && mainSrc && (
        <ModalImagenPrevia
          images={images}
          initialIndex={activeIdx}
          onClose={() => setModalOpen(false)}
        />
      )}

      {carrito.length > 0 && !mostrarCarrito && (
        <button
          type="button"
          onClick={() => startTransition(() => setMostrarCarrito(true))}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-5 py-3.5 text-base font-bold text-white shadow-xl shadow-pink-400/50 transition-all duration-200 hover:scale-[1.03] hover:shadow-2xl hover:shadow-pink-400/60 active:scale-[0.98] dark:shadow-pink-900/40"
          aria-label={`Abrir carrito, ${carrito.length} ítems, total ${formatPesoAR(total)} pesos`}
        >
          <div className="relative">
            <ShoppingBag className="h-6 w-6" aria-hidden />
            <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-pink-600">
              {carrito.length}
            </span>
          </div>
          <span className="text-lg font-extrabold tabular-nums">${formatPesoAR(total)}</span>
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
        onWhatsApp={handleCarritoWhatsApp}
        onSolicitarVaciar={() => setMostrarConfirmacion(true)}
      />

      <ModalConfirmacionVaciar
        open={mostrarConfirmacion}
        onClose={() => setMostrarConfirmacion(false)}
        onConfirm={vaciarCarritoYcerrar}
      />
    </div>
  )
}
