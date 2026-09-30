'use client'

import { startTransition, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { getProductImages } from '@/lib/supabase'
import type { PublicCatalogCombo, PublicCatalogProduct } from '@/lib/domain/catalog/publicDto'
import { openWhatsApp } from '@/lib/whatsappLink'
import { cartSubtotal, couponDiscountFromPercent, totalAfterCoupon } from '@/lib/catalogPricing'
import { catalogDisplayComboPrice } from '@/lib/domain/payments/catalogDisplayPrice'
import { getCatalogBadgesForProduct } from '@/lib/catalogBadges'
import { formatPesoAR } from '@/lib/formatPesoAR'
import { useToast } from '@/context/ToastContext'
import { ORDEN_DEFAULT, ORDEN_OPTIONS, PRODUCTOS_POR_PAGINA } from '@/components/Catalogo/catalogConstants'
import { useCarrito } from '@/hooks/useCarrito'
import { useCatalogCoupon } from '@/hooks/useCatalogCoupon'
import { useCatalogData, type CatalogInitialSnapshot } from '@/hooks/useCatalogData'
import { useCatalogDerivedLists } from '@/hooks/useCatalogDerivedLists'
import { validarCuponCatalogo } from '@/app/actions/coupons'
import {
  COMBOS_FILTER,
  catalogViewPath,
  parseCatalogView,
  type CatalogViewState,
} from '@/lib/domain/catalog/catalogView'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { CategoryNav } from '@/components/storefront/CategoryNav'
import { ProductCard } from '@/components/storefront/ProductCard'
import { FilterSheet } from '@/components/storefront/FilterSheet'
import { EmptyState } from '@/components/storefront/EmptyState'
import styles from '@/components/storefront/storefront.module.css'

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
const ModalDetalleCombo = dynamic(
  () => import('@/components/Catalogo/ModalDetalleCombo').then(m => ({ default: m.ModalDetalleCombo })),
  { ssr: false }
)

type CatalogoProps = {
  initialCatalog?: CatalogInitialSnapshot | null
  initialView?: CatalogViewState
}

export default function Catalogo({ initialCatalog = null, initialView }: CatalogoProps) {
  const { showToast: baseShowToast } = useToast()
  const [mostrarCarrito, setMostrarCarrito] = useState(false)
  const [mostrarCheckout, setMostrarCheckout] = useState(false)
  const [checkoutConfirmado, setCheckoutConfirmado] = useState(false)
  const [verificandoBolsa, setVerificandoBolsa] = useState(false)
  const showToast = useCallback((type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    const action = (type === 'success' && message.toLowerCase().includes('bolsa'))
      ? { label: 'Ver bolsa', onClick: () => setMostrarCarrito(true) }
      : undefined
    baseShowToast(type, message, 4000, action)
  }, [baseShowToast])

  const {
    carrito,
    cartReady,
    agregarAlCarrito,
    agregarComboAlCarrito,
    quitarDelCarrito,
    quitarComboDelCarrito,
    actualizarCantidad,
    actualizarCantidadCombo,
    clearCarrito,
    refreshCarrito,
  } = useCarrito(showToast)

  const seed = initialView ?? parseCatalogView({})
  const seededFromServer = initialView != null
  const [categoriaFiltro, setCategoriaFiltroState] = useState(seed.cat)
  const [busqueda, setBusquedaState] = useState(seed.q)
  const [precioMin, setPrecioMinState] = useState(seed.min)
  const [precioMax, setPrecioMaxState] = useState(seed.max)
  const [ordenamiento, setOrdenamientoState] = useState(seed.sort || ORDEN_DEFAULT)
  const [paginaActual, setPaginaActual] = useState(seed.page)
  const urlReady = useRef(seededFromServer)
  const setCategoriaFiltro = (value: string) => { setCategoriaFiltroState(value); setPaginaActual(1) }
  const setBusqueda = (value: string) => { setBusquedaState(value); setPaginaActual(1) }
  const setPrecioMin = (value: number) => { setPrecioMinState(value); setPaginaActual(1) }
  const setPrecioMax = (value: number) => { setPrecioMaxState(value); setPaginaActual(1) }
  const setOrdenamiento = (value: string) => { setOrdenamientoState(value); setPaginaActual(1) }
  const {
    productos,
    combos,
    categorias,
    cargando,
    catalogLoadError,
    recargarCatalogo,
    ventasPorProducto,
  } = useCatalogData(ordenamiento, initialCatalog)

  const [comboSeleccionado, setComboSeleccionado] = useState<PublicCatalogCombo | null>(null)
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)
  const [cuponInput, setCuponInput] = useState('')
  const { appliedCoupon, setAppliedCoupon } = useCatalogCoupon()
  const searchRef = useRef<HTMLInputElement>(null)

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

  useLayoutEffect(() => {
    if (seededFromServer) {
      urlReady.current = true
      return
    }
    const view = parseCatalogView(new URLSearchParams(window.location.search))
    setCategoriaFiltroState(view.cat)
    setBusquedaState(view.q)
    setPrecioMinState(view.min)
    setPrecioMaxState(view.max)
    setOrdenamientoState(view.sort || ORDEN_DEFAULT)
    setPaginaActual(view.page)
    urlReady.current = true
  }, [seededFromServer])

  useEffect(() => {
    if (cargando || catalogLoadError) return
    if (paginaActual > totalPaginas) setPaginaActual(totalPaginas)
  }, [paginaActual, totalPaginas, cargando, catalogLoadError])

  useEffect(() => {
    if (!urlReady.current) return
    const path = catalogViewPath({
      q: busqueda,
      cat: categoriaFiltro,
      sort: ordenamiento,
      page: paginaActual,
      min: precioMin,
      max: precioMax,
    })
    const current = `${window.location.pathname}${window.location.search}`
    if (current !== path) window.history.replaceState(null, '', path)
  }, [busqueda, categoriaFiltro, ordenamiento, paginaActual, precioMin, precioMax])

  useEffect(() => {
    if (paginaActual > 1) {
      document.querySelector('#productos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [paginaActual])

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

  const clearFilters = () => {
    setBusqueda('')
    setCategoriaFiltro('all')
    setPrecioMin(0)
    setPrecioMax(999999)
    setOrdenamiento(ORDEN_DEFAULT)
  }

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

  const searching = busqueda.trim().length > 0
  const categoryName = categoriaFiltro === COMBOS_FILTER
    ? 'Combos'
    : categorias.find(c => String(c.id) === categoriaFiltro)?.name
  const toolbarTitle = searching
    ? 'Resultados de búsqueda'
    : categoryName ?? 'Explorá el catálogo'
  const activeFilterCount = [
    categoriaFiltro !== 'all',
    precioMin > 0,
    precioMax < 999999,
  ].filter(Boolean).length

  const comboImage = (combo: PublicCatalogCombo) => {
    if (combo.image_url) return combo.image_url
    for (const item of combo.combo_items || []) {
      const img = item.products ? getProductImages(item.products)[0] : null
      if (img) return img
    }
    return null
  }

  return (
    <StorefrontShell
      header={
        <>
          <StorefrontHeader
            bagCount={carrito.reduce((sum, item) => sum + item.cantidad, 0)}
            onBag={() => startTransition(() => setMostrarCarrito(true))}
            search={busqueda}
            onSearch={setBusqueda}
            searchRef={searchRef}
          />
          <CategoryNav
            categorias={categorias}
            value={categoriaFiltro}
            onChange={setCategoriaFiltro}
            showCombos={combos.length > 0}
          />
        </>
      }
    >
      <main className={styles.wrap}>
        <section className={`${styles.intro} ${searching ? styles.introHidden : ''}`} aria-labelledby="catalogo-titulo-principal">
          <p className={styles.eyebrow}>Tu próxima obsesión, acá.</p>
          <h1 id="catalogo-titulo-principal">Un poco de color. Mucho de vos.</h1>
          <p>Maquillaje, skincare y cosmética en Neuquén.</p>
        </section>

        <div className={styles.toolbar} id="productos">
          <h2>
            {toolbarTitle}
            <span className={styles.toolbarMeta}> · {totalItems}</span>
          </h2>
          <button
            className={styles.filterBtn}
            type="button"
            onClick={() => setMostrarFiltros(true)}
            aria-expanded={mostrarFiltros}
          >
            Filtros{activeFilterCount ? ` · ${activeFilterCount}` : ''}
          </button>
          <select
            aria-label="Ordenar productos"
            value={ordenamiento}
            onChange={(event) => setOrdenamiento(event.target.value)}
          >
            {ORDEN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {activeFilterCount > 0 ? (
            <div className={styles.chips}>
              {categoriaFiltro !== 'all' ? (
                <button type="button" className={styles.chip} onClick={() => setCategoriaFiltro('all')}>
                  {categoryName ?? 'Categoría'} ✕
                </button>
              ) : null}
              {precioMin > 0 ? (
                <button type="button" className={styles.chip} onClick={() => setPrecioMin(0)}>
                  Desde ${formatPesoAR(precioMin)} ✕
                </button>
              ) : null}
              {precioMax < 999999 ? (
                <button type="button" className={styles.chip} onClick={() => setPrecioMax(999999)}>
                  Hasta ${formatPesoAR(precioMax)} ✕
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {cargando ? (
          <div className={styles.grid} aria-busy="true" role="status">
            <span className="sr-only">Cargando catálogo</span>
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className={styles.skeletonCard}>
                <div className={styles.skeletonPhoto} />
                <div className={styles.skeletonLine} />
                <div className={styles.skeletonLine} style={{ width: '40%' }} />
              </div>
            ))}
          </div>
        ) : catalogLoadError ? (
          <div className={styles.state}>
            <RefreshCw size={28} aria-hidden />
            <h2>No pudimos cargar el catálogo</h2>
            <p>Puede ser un problema de conexión. Probá de nuevo en unos segundos.</p>
            <button className={styles.primaryBtn} type="button" onClick={() => void recargarCatalogo()}>
              Reintentar
            </button>
          </div>
        ) : totalItems > 0 ? (
          <>
            <div className={styles.grid}>
              {itemsPagina.map((item, slotIndex) => {
                const esCombo = 'combo_items' in item
                if (esCombo) {
                  const combo = item as PublicCatalogCombo
                  const disponible = comboDisponible(combo)
                  return (
                    <ProductCard
                      key={`combo-${combo.id}`}
                      name={combo.name}
                      brand="Combo"
                      image={comboImage(combo)}
                      badge="Combo"
                      amount={combo.sale_price}
                      dual={combo.dual_price_visible === true}
                      publicAmount={combo.public_price}
                      transferAmount={combo.transfer_price}
                      available={disponible}
                      cartReady={cartReady}
                      onAdd={() => { if (disponible) startTransition(() => agregarComboAlCarrito(combo)) }}
                      onOpen={() => startTransition(() => setComboSeleccionado(combo))}
                      comboIncludes={() => startTransition(() => setComboSeleccionado(combo))}
                      priority={slotIndex < 4}
                    />
                  )
                }

                const producto = item as PublicCatalogProduct
                const badge = getCatalogBadgesForProduct(producto)[0]?.texto ?? null
                return (
                  <ProductCard
                    key={`producto-${producto.id}`}
                    name={producto.name}
                    href={`/catalogo/p/${producto.id}`}
                    brand={producto.brand}
                    image={getProductImages(producto)[0] ?? null}
                    badge={badge}
                    amount={getPrecioConDescuento(producto)}
                    listAmount={producto.sale_price}
                    dual={producto.dual_price_visible === true}
                    publicAmount={producto.public_price}
                    transferAmount={producto.transfer_price ?? getPrecioConDescuento(producto)}
                    available={producto.stock > 0}
                    cartReady={cartReady}
                    onAdd={() => { if (producto.stock > 0) startTransition(() => agregarAlCarrito(producto)) }}
                    priority={slotIndex < 4}
                  />
                )
              })}
            </div>

            {totalPaginas > 1 && (
              <nav className={styles.pagination} aria-label="Paginación del catálogo">
                <span>Mostrando {inicio + 1}–{Math.min(inicio + PRODUCTOS_POR_PAGINA, totalItems)} de {totalItems}</span>
                <div className={styles.pageBtns}>
                  {paginaActual === 1 ? (
                    <span className={styles.pageBtn} aria-hidden><ChevronLeft size={17} /></span>
                  ) : (
                    <Link
                      className={styles.pageBtn}
                      href={catalogViewPath({ q: busqueda, cat: categoriaFiltro, sort: ordenamiento, page: paginaActual - 1, min: precioMin, max: precioMax })}
                      aria-label="Página anterior"
                      onClick={(event) => { event.preventDefault(); setPaginaActual(paginaActual - 1) }}
                    >
                      <ChevronLeft size={17} />
                    </Link>
                  )}
                  {Array.from({ length: totalPaginas }, (_, index) => index + 1).map(page => (
                    <Link
                      key={page}
                      className={page === paginaActual ? `${styles.pageBtn} ${styles.pageBtnActive}` : styles.pageBtn}
                      href={catalogViewPath({ q: busqueda, cat: categoriaFiltro, sort: ordenamiento, page, min: precioMin, max: precioMax })}
                      aria-current={page === paginaActual ? 'page' : undefined}
                      aria-label={`Página ${page}`}
                      onClick={(event) => { event.preventDefault(); setPaginaActual(page) }}
                    >
                      {page}
                    </Link>
                  ))}
                  {paginaActual === totalPaginas ? (
                    <span className={styles.pageBtn} aria-hidden><ChevronRight size={17} /></span>
                  ) : (
                    <Link
                      className={styles.pageBtn}
                      href={catalogViewPath({ q: busqueda, cat: categoriaFiltro, sort: ordenamiento, page: paginaActual + 1, min: precioMin, max: precioMax })}
                      aria-label="Página siguiente"
                      onClick={(event) => { event.preventDefault(); setPaginaActual(paginaActual + 1) }}
                    >
                      <ChevronRight size={17} />
                    </Link>
                  )}
                </div>
              </nav>
            )}
          </>
        ) : (
          <EmptyState
            title="No encontramos productos"
            body="Probá otra búsqueda o quitá los filtros."
            actionLabel="Limpiar filtros"
            onAction={clearFilters}
          />
        )}

      </main>

      {mostrarFiltros ? (
        <FilterSheet
          key={`${precioMin}-${precioMax}`}
          open
          onClose={() => setMostrarFiltros(false)}
          precioMin={precioMin}
          precioMax={precioMax}
          onApply={(min, max) => {
            setPrecioMin(min)
            setPrecioMax(max)
          }}
          onClear={clearFilters}
        />
      ) : null}

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

      {comboSeleccionado && (
        <ModalDetalleCombo
          combo={comboSeleccionado}
          onClose={() => setComboSeleccionado(null)}
          onAgregar={() => agregarComboAlCarrito(comboSeleccionado)}
          disponible={comboDisponible(comboSeleccionado)}
        />
      )}
    </StorefrontShell>
  )
}
