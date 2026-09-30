'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Minus, Plus, X } from 'lucide-react'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import { getProductImages } from '@/lib/supabase'
import type { CatalogCartItem } from '@/hooks/useCarrito'
import type { PublicCatalogProduct } from '@/lib/domain/catalog/publicDto'
import { formatPesoAR } from '@/lib/formatPesoAR'
import { OrderSummary } from '@/components/storefront/OrderSummary'
import { catalogDisplayComboPrice } from '@/lib/domain/payments/catalogDisplayPrice'
import styles from '@/components/storefront/storefront.module.css'

interface ModalCarritoProps {
    open: boolean
    onClose: () => void
    carrito: CatalogCartItem[]
    getPrecioConDescuento: (producto: PublicCatalogProduct) => number
    quitarDelCarrito: (productoId: number) => void
    quitarComboDelCarrito?: (comboId: number) => void
    actualizarCantidad: (productoId: number, cambio: number) => void
    actualizarCantidadCombo?: (comboId: number, cambio: number) => void
    cuponInput: string
    setCuponInput: (v: string) => void
    appliedCoupon: { code: string; discount_percentage: number } | null
    onAplicarCupon: () => void
    quitarCupon: () => void
    subtotal: number
    descuentoCupon: number
    total: number
    onWhatsApp: () => void
    onCheckout?: () => void
    verifying?: boolean
    onSolicitarVaciar: () => void
}

export function ModalCarrito({
    open,
    onClose,
    carrito,
    getPrecioConDescuento,
    quitarDelCarrito,
    quitarComboDelCarrito,
    actualizarCantidad,
    actualizarCantidadCombo,
    cuponInput,
    setCuponInput,
    appliedCoupon,
    onAplicarCupon,
    quitarCupon,
    subtotal,
    descuentoCupon,
    total,
    onWhatsApp,
    onCheckout,
    verifying = false,
    onSolicitarVaciar,
}: ModalCarritoProps) {
    const panelRef = useRef<HTMLElement>(null)
    const [mostrarCupon, setMostrarCupon] = useState(false)
    useDialogA11y(open, onClose, panelRef)

    useEffect(() => {
        if (!open) return
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = previousOverflow
        }
    }, [open])

    if (!open) return null

    const cantidadTotal = carrito.reduce((sum, item) => sum + item.cantidad, 0)
    const summaryItems = carrito.map(item => {
        const esProducto = !!item.producto
        return {
            name: esProducto ? item.producto!.name : item.combo!.name,
            quantity: item.cantidad,
            unitPrice: esProducto ? getPrecioConDescuento(item.producto!) : catalogDisplayComboPrice(item.combo!),
        }
    })

    return (
        <div className={`storefront ${styles.overlay}`}>
            <button className={styles.backdrop} type="button" onClick={onClose} aria-label="Cerrar bolsa" />

            <aside
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-carrito-titulo"
                className={styles.drawer}
            >
                <header className={styles.drawerHead}>
                    <div>
                        <p className={styles.muted}>Seguir mirando</p>
                        <h2 id="modal-carrito-titulo">Tu bolsa</h2>
                        <p className={styles.muted} aria-live="polite">
                            {cantidadTotal} {cantidadTotal === 1 ? 'producto' : 'productos'}
                        </p>
                    </div>
                    <div>
                        <button className={styles.iconBtn} type="button" onClick={onClose} aria-label="Cerrar bolsa">
                            <X size={18} />
                        </button>
                        {carrito.length > 0 && (
                            <button className={styles.comboLink} type="button" onClick={onSolicitarVaciar}>
                                Vaciar
                            </button>
                        )}
                    </div>
                </header>

                {carrito.length > 0 ? (
                    <>
                        <div className={styles.drawerBody}>
                            {carrito.map(item => {
                                const esProducto = !!item.producto
                                const producto = item.producto
                                const combo = item.combo
                                const nombre = esProducto ? producto!.name : combo!.name
                                const precioUnit = esProducto ? getPrecioConDescuento(producto!) : catalogDisplayComboPrice(combo!)
                                const imagen = esProducto ? getProductImages(producto!)[0] : combo!.image_url
                                const key = esProducto ? `p-${producto!.id}` : `c-${combo!.id}`
                                const maxStock = esProducto ? producto!.stock : undefined

                                const cambiarCantidad = (cambio: number) => {
                                    if (esProducto) actualizarCantidad(producto!.id, cambio)
                                    else actualizarCantidadCombo?.(combo!.id, cambio)
                                }

                                const quitarItem = () => {
                                    if (esProducto) quitarDelCarrito(producto!.id)
                                    else quitarComboDelCarrito?.(combo!.id)
                                }

                                return (
                                    <article key={key} className={styles.itemRow}>
                                        <div className={styles.mini}>
                                            {imagen ? (
                                                <Image src={imagen} alt="" fill sizes="70px" />
                                            ) : (
                                                <span className={styles.photoFallback}>Sin imagen</span>
                                            )}
                                        </div>

                                        <div className={styles.itemCopy}>
                                            <h3>{nombre}</h3>
                                            <p className={styles.muted}>${formatPesoAR(precioUnit)} por unidad</p>
                                            <div className={styles.qty} aria-label={`Cantidad de ${nombre}`}>
                                                <button
                                                    type="button"
                                                    onClick={() => cambiarCantidad(-1)}
                                                    disabled={item.cantidad <= 1}
                                                    aria-label={`Reducir cantidad de ${nombre}`}
                                                >
                                                    <Minus size={15} />
                                                </button>
                                                <span>{item.cantidad}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => cambiarCantidad(1)}
                                                    disabled={maxStock !== undefined && item.cantidad >= maxStock}
                                                    aria-label={`Aumentar cantidad de ${nombre}`}
                                                >
                                                    <Plus size={15} />
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <button className={styles.removeBtn} type="button" onClick={quitarItem} aria-label={`Quitar ${nombre} de la bolsa`}>
                                                Quitar
                                            </button>
                                            <p><strong>${formatPesoAR(precioUnit * item.cantidad)}</strong></p>
                                        </div>
                                    </article>
                                )
                            })}

                            <details className={styles.coupon} open={mostrarCupon} onToggle={(event) => setMostrarCupon((event.target as HTMLDetailsElement).open)}>
                                <summary>¿Tenés un cupón?</summary>
                                {!appliedCoupon ? (
                                    <form
                                        className={styles.couponForm}
                                        onSubmit={event => {
                                            event.preventDefault()
                                            onAplicarCupon()
                                        }}
                                    >
                                        <label className="sr-only" htmlFor="catalogo-coupon-code">Código de cupón</label>
                                        <input
                                            id="catalogo-coupon-code"
                                            type="text"
                                            value={cuponInput}
                                            onChange={event => setCuponInput(event.target.value)}
                                            placeholder="Ingresá tu código"
                                            autoComplete="off"
                                        />
                                        <button className={styles.secondaryBtn} type="submit">Aplicar</button>
                                    </form>
                                ) : (
                                    <div className={styles.summaryRow}>
                                        <span className={styles.successText}>{appliedCoupon.code} · {appliedCoupon.discount_percentage}% de descuento</span>
                                        <button type="button" className={styles.comboLink} onClick={quitarCupon}>Quitar</button>
                                    </div>
                                )}
                            </details>
                        </div>

                        <footer className={styles.drawerFoot}>
                            <OrderSummary
                                items={summaryItems}
                                productsTotal={subtotal}
                                couponCode={appliedCoupon?.code}
                                couponDiscount={descuentoCupon}
                                shippingLabel="Aún sin determinar"
                                hideItems
                            />
                            {onCheckout ? (
                                <button
                                    className={`${styles.primaryBtn} ${styles.wide}`}
                                    type="button"
                                    onClick={onCheckout}
                                    disabled={verifying}
                                    data-testid="cart-checkout"
                                >
                                    {verifying ? 'Verificando bolsa…' : 'Continuar con mi pedido'}
                                </button>
                            ) : null}
                            <button
                                className={`${styles.secondaryBtn} ${styles.wide}`}
                                type="button"
                                onClick={onWhatsApp}
                                data-testid="cart-whatsapp-fallback"
                                style={{ marginTop: 10 }}
                            >
                                Pedir por WhatsApp
                            </button>
                            <p className={styles.muted} style={{ marginTop: 8 }}>
                                WhatsApp no reemplaza el pedido web. Subtotal de referencia: ${formatPesoAR(total)}.
                            </p>
                        </footer>
                    </>
                ) : (
                    <div className={styles.empty}>
                        <h2>Tu bolsa está esperando</h2>
                        <p>Elegí algo que te guste y lo guardamos acá.</p>
                        <button className={styles.primaryBtn} type="button" onClick={onClose}>Explorar productos</button>
                    </div>
                )}
            </aside>
        </div>
    )
}
