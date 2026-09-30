'use client'

import { useCallback, useContext, useEffect, useRef, useState, startTransition } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { getProductImages } from '@/lib/supabase'
import type { PublicCatalogProduct } from '@/lib/domain/catalog/publicDto'
import {
  cartSubtotal,
  couponDiscountFromPercent,
  priceWithProductDiscount,
  totalAfterCoupon,
} from '@/lib/catalogPricing'
import { validarCuponCatalogo } from '@/app/actions/coupons'
import { formatPesoAR } from '@/lib/formatPesoAR'
import { catalogDisplayComboPrice, catalogDisplayUnitPrice } from '@/lib/domain/payments/catalogDisplayPrice'
import { getShareAbsoluteUrl } from '@/lib/site'
import { openWhatsApp } from '@/lib/whatsappLink'
import { useCarrito } from '@/hooks/useCarrito'
import { useCatalogCoupon } from '@/hooks/useCatalogCoupon'
import { ToastContext } from '@/context/ToastContext'
import { CatalogPrice } from '@/components/Catalogo/CatalogPrice'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { ProductGallery } from '@/components/storefront/ProductGallery'
import { ProductCard } from '@/components/storefront/ProductCard'
import { MobilePurchaseBar } from '@/components/storefront/MobilePurchaseBar'
import styles from '@/components/storefront/storefront.module.css'

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
const CheckoutPedido = dynamic(
  () => import('@/components/Catalogo/CheckoutPedido').then(m => ({ default: m.CheckoutPedido })),
  { ssr: false }
)

type Props = {
  producto: PublicCatalogProduct
  canonicalPath: string
  relatedProducts?: PublicCatalogProduct[]
}

export function ProductPublicDetailClient({ producto, canonicalPath, relatedProducts = [] }: Props) {
  const toastCtx = useContext(ToastContext)
  const [mostrarCarrito, setMostrarCarrito] = useState(false)
  const showToast = useCallback(
    (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
      const action = (type === 'success' && message.toLowerCase().includes('bolsa'))
        ? { label: 'Ver bolsa', onClick: () => setMostrarCarrito(true) }
        : undefined
      toastCtx?.showToast(type, message, 4000, action)
    },
    [toastCtx]
  )
  const {
    carrito,
    cartReady,
    agregarAlCarrito,
    clearCarrito,
    quitarDelCarrito,
    quitarComboDelCarrito,
    actualizarCantidad,
    actualizarCantidadCombo,
    refreshCarrito,
  } = useCarrito(showToast)

  const images = getProductImages(producto)
  const [activeIdx, setActiveIdx] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [mostrarCheckout, setMostrarCheckout] = useState(false)
  const [checkoutConfirmado, setCheckoutConfirmado] = useState(false)
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)
  const [verificandoBolsa, setVerificandoBolsa] = useState(false)
  const [cuponInput, setCuponInput] = useState('')
  const [qty, setQty] = useState(1)
  const [ctaVisible, setCtaVisible] = useState(true)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const ctaRef = useRef<HTMLButtonElement>(null)
  const { appliedCoupon, setAppliedCoupon } = useCatalogCoupon()

  const getPrecioConDescuento = useCallback(
    (p: PublicCatalogProduct) => catalogDisplayUnitPrice(p),
    []
  )

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

  const quitarCupon = () => setAppliedCoupon(null)

  const handleCarritoWhatsApp = () => {
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

  const precio = priceWithProductDiscount(producto.sale_price, producto.discount_percentage)
  const dualVisible = producto.dual_price_visible === true && producto.public_price != null
  const displayPrice = catalogDisplayUnitPrice(producto)

  const consultarWhatsApp = () => {
    const link = getShareAbsoluteUrl(canonicalPath)
    const lineas = [
      '¡Hola! Consulto por este producto:',
      '',
      `*${producto.name}*`,
      ...(producto.brand ? [producto.brand] : []),
      `Precio: $${formatPesoAR(displayPrice)}`,
      link,
    ]
    if (!openWhatsApp(lineas.join('\n'), false)) {
      showToast('error', 'No se pudo generar el enlace de WhatsApp')
    }
  }

  const stockAgotado = producto.stock <= 0
  const stockBajo = !stockAgotado && producto.stock <= 3
  const colorDetalle = producto.color?.trim()
  const addDisabled = stockAgotado || !cartReady
  const addLabel = !cartReady ? 'Verificando…' : stockAgotado ? 'Sin stock' : `Agregar a la bolsa · $${formatPesoAR(displayPrice)}`

  const addToBag = () => {
    if (addDisabled) return
    agregarAlCarrito(producto, qty)
  }

  useEffect(() => {
    const node = ctaRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setCtaVisible(entry.isIntersecting), { threshold: 0.4 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const onResize = () => setKeyboardOpen(window.innerHeight - viewport.height > 120)
    viewport.addEventListener('resize', onResize)
    return () => viewport.removeEventListener('resize', onResize)
  }, [])

  const openCheckout = async () => {
    if (verificandoBolsa) return
    setVerificandoBolsa(true)
    try {
      if (!await refreshCarrito()) return
      setMostrarCarrito(false)
      setMostrarCheckout(true)
    } finally {
      setVerificandoBolsa(false)
    }
  }

  const showMobileBar = !ctaVisible && !mostrarCarrito && !mostrarCheckout && !modalOpen && !keyboardOpen

  return (
    <StorefrontShell
      header={
        <StorefrontHeader
          bagCount={carrito.reduce((sum, item) => sum + item.cantidad, 0)}
          onBag={() => startTransition(() => setMostrarCarrito(true))}
          simple
        />
      }
    >
      <main className={styles.wrap}>
        <nav className={styles.crumb} aria-label="Migas de pan">
          <Link href="/catalogo">Catálogo</Link>
          {producto.categories?.name ? ` / ${producto.categories.name}` : ''}
        </nav>

        <div className={styles.pdp}>
          <ProductGallery
            name={producto.name}
            images={images}
            activeIdx={activeIdx}
            onChange={setActiveIdx}
            onZoom={() => startTransition(() => setModalOpen(true))}
          />

          <section className={styles.pdpBuy}>
            {producto.brand ? <p className={styles.eyebrow}>{producto.brand}</p> : null}
            <h1>{producto.name}</h1>
            <CatalogPrice
              className={styles.pdpPrice}
              amount={displayPrice}
              listAmount={(producto.discount_percentage ?? 0) > 0 ? producto.sale_price : null}
              dual={dualVisible}
              publicAmount={producto.public_price}
              transferAmount={producto.transfer_price ?? precio}
            />
            <p className={stockAgotado ? styles.stockOut : stockBajo ? styles.stockLow : styles.stockOk} role="status">
              {stockAgotado ? 'Sin stock' : stockBajo ? `Últimas unidades · ${producto.stock}` : 'Disponible'}
            </p>

            <div className={styles.qty} aria-label="Cantidad">
              <button type="button" onClick={() => setQty(value => Math.max(1, value - 1))} disabled={qty <= 1} aria-label="Reducir cantidad">−</button>
              <span>{qty}</span>
              <button type="button" onClick={() => setQty(value => Math.min(producto.stock || 1, value + 1))} disabled={stockAgotado || qty >= producto.stock} aria-label="Aumentar cantidad">＋</button>
            </div>

            <button
              ref={ctaRef}
              type="button"
              className={`${styles.primaryBtn} ${styles.wide}`}
              disabled={addDisabled}
              onClick={addToBag}
            >
              {addLabel}
            </button>
            <button type="button" className={`${styles.secondaryBtn} ${styles.wide}`} onClick={consultarWhatsApp} style={{ marginTop: 12 }}>
              Consultar por WhatsApp
            </button>

            <div className={styles.line}>
              <strong>Entrega y retiro</strong>
              <p>Elegí retiro o consultá el costo de envío al completar tu pedido.</p>
            </div>

            {colorDetalle ? (
              <div className={styles.line}>
                <strong>Color / tono</strong>
                <p>{colorDetalle}</p>
              </div>
            ) : null}
          </section>
        </div>

        {relatedProducts.length > 0 && (
          <section className={styles.line}>
            <h2>También te puede interesar</h2>
            <div className={styles.grid} style={{ marginTop: 20 }}>
              {relatedProducts.map((rel, index) => (
                <ProductCard
                  key={rel.id}
                  name={rel.name}
                  href={`/catalogo/p/${rel.id}`}
                  brand={rel.brand}
                  image={getProductImages(rel)[0] ?? null}
                  amount={catalogDisplayUnitPrice(rel)}
                  listAmount={rel.sale_price}
                  dual={rel.dual_price_visible === true}
                  publicAmount={rel.public_price}
                  transferAmount={rel.transfer_price ?? catalogDisplayUnitPrice(rel)}
                  available={rel.stock > 0}
                  cartReady={cartReady}
                  onAdd={() => { if (rel.stock > 0) agregarAlCarrito(rel) }}
                  priority={index === 0}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <MobilePurchaseBar
        visible={showMobileBar}
        disabled={addDisabled}
        label={addLabel}
        onAdd={addToBag}
      />

      {modalOpen && images.length > 0 && (
        <ModalImagenPrevia
          images={images}
          initialIndex={activeIdx}
          onClose={() => setModalOpen(false)}
        />
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
        quitarCupon={quitarCupon}
        subtotal={subtotal}
        descuentoCupon={descuentoCupon}
        total={total}
        onWhatsApp={handleCarritoWhatsApp}
        verifying={verificandoBolsa}
        onCheckout={openCheckout}
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
          onBack={() => { setMostrarCheckout(false); setMostrarCarrito(true) }}
          carrito={carrito}
          appliedCoupon={appliedCoupon}
          subtotal={subtotal}
          descuentoCupon={descuentoCupon}
          total={total}
          showToast={showToast}
          onOrderCreated={() => setCheckoutConfirmado(true)}
        />
      )}

      <ModalConfirmacionVaciar
        open={mostrarConfirmacion}
        onClose={() => setMostrarConfirmacion(false)}
        onConfirm={vaciarCarritoYcerrar}
      />
    </StorefrontShell>
  )
}
