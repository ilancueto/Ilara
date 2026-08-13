'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ArrowUpRight, MessageCircle, Minus, Plus, ShoppingBag, Sparkles, X } from 'lucide-react'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import { getProductImages } from '@/lib/supabase'
import type { CatalogCartItem } from '@/hooks/useCarrito'
import type { PublicCatalogProduct } from '@/lib/domain/catalog/publicDto'
import { formatPesoAR } from '@/lib/formatPesoAR'
import styles from '@/components/Catalogo/ModalCarrito.module.css'

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
    /** Stage 6.1 — abre checkout y persiste pedido antes de WhatsApp. */
    onCheckout?: () => void
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

    return (
        <div className={styles.overlay}>
            <button className={styles.backdrop} type="button" onClick={onClose} aria-label="Cerrar bolsa" />

            <aside
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-carrito-titulo"
                className={styles.drawer}
            >
                <header className={styles.head}>
                    <div>
                        <p className={styles.eyebrow}>Tu selección</p>
                        <h2 id="modal-carrito-titulo" className={styles.title}>Bolsa</h2>
                        <p className={styles.count} aria-live="polite">
                            {cantidadTotal} {cantidadTotal === 1 ? 'producto' : 'productos'}
                        </p>
                    </div>
                    <div className={styles.headActions}>
                        <button className={styles.close} type="button" onClick={onClose} aria-label="Cerrar bolsa">
                            <X size={18} />
                        </button>
                        {carrito.length > 0 && (
                            <button className={styles.clear} type="button" onClick={onSolicitarVaciar}>
                                Vaciar
                            </button>
                        )}
                    </div>
                </header>

                {carrito.length > 0 ? (
                    <>
                        <div className={styles.items}>
                            {carrito.map(item => {
                                const esProducto = !!item.producto
                                const producto = item.producto
                                const combo = item.combo
                                const nombre = esProducto ? producto!.name : combo!.name
                                const categoria = esProducto
                                    ? (producto!.categories?.name ?? producto!.brand ?? 'Belleza')
                                    : 'Combo Ilara'
                                const precioUnit = esProducto ? getPrecioConDescuento(producto!) : combo!.sale_price
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
                                    <article key={key} className={styles.item}>
                                        <div className={styles.media}>
                                            {imagen ? (
                                                <Image src={imagen} alt={nombre} fill sizes="92px" />
                                            ) : (
                                                <span className={styles.mediaFallback}>
                                                    <Sparkles size={28} aria-hidden />
                                                </span>
                                            )}
                                        </div>

                                        <div className={styles.itemCopy}>
                                            <span className={styles.category}>{categoria}</span>
                                            <h3 className={styles.itemName}>{nombre}</h3>
                                            <p className={styles.unitPrice}>${formatPesoAR(precioUnit)} c/u</p>
                                            <div className={styles.quantity} aria-label={`Cantidad de ${nombre}`}>
                                                <button
                                                    type="button"
                                                    onClick={() => cambiarCantidad(-1)}
                                                    disabled={item.cantidad <= 1}
                                                    aria-label={`Reducir cantidad de ${nombre}`}
                                                >
                                                    <Minus size={15} />
                                                </button>
                                                <span className={styles.quantityValue}>{item.cantidad}</span>
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

                                        <div className={styles.itemEnd}>
                                            <button className={styles.remove} type="button" onClick={quitarItem} aria-label={`Quitar ${nombre} de la bolsa`}>
                                                <X size={14} />
                                            </button>
                                            <p className={styles.lineTotal}>${formatPesoAR(precioUnit * item.cantidad)}</p>
                                        </div>
                                    </article>
                                )
                            })}
                        </div>

                        <section className={styles.coupon} aria-label="Cupón de descuento">
                            {!appliedCoupon ? (
                                <>
                                    <button
                                        className={styles.couponToggle}
                                        type="button"
                                        onClick={() => setMostrarCupon(value => !value)}
                                        aria-expanded={mostrarCupon}
                                    >
                                        <span>¿Tenés un cupón?</span>
                                        <Plus className={`${styles.couponPlus} ${mostrarCupon ? styles.couponPlusOpen : ''}`} size={17} />
                                    </button>
                                    {mostrarCupon && (
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
                                                className={styles.couponInput}
                                                type="text"
                                                value={cuponInput}
                                                onChange={event => setCuponInput(event.target.value)}
                                                placeholder="Ingresar cupón"
                                                autoComplete="off"
                                            />
                                            <button className={styles.couponApply} type="submit">Aplicar</button>
                                        </form>
                                    )}
                                </>
                            ) : (
                                <div className={styles.couponApplied}>
                                    <span>{appliedCoupon.code} · {appliedCoupon.discount_percentage}% de descuento</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMostrarCupon(false)
                                            quitarCupon()
                                        }}
                                    >
                                        Quitar
                                    </button>
                                </div>
                            )}
                        </section>

                        <footer className={styles.foot}>
                            <div className={styles.summaryLine}>
                                <span>Subtotal</span>
                                <span>${formatPesoAR(subtotal)}</span>
                            </div>
                            {appliedCoupon && (
                                <div className={`${styles.summaryLine} ${styles.summaryDiscount}`}>
                                    <span>Descuento {appliedCoupon.code}</span>
                                    <span>−${formatPesoAR(descuentoCupon)}</span>
                                </div>
                            )}
                            <div className={styles.totalLine}>
                                <span className={styles.totalLabel}>Total</span>
                                <strong className={styles.totalValue}>${formatPesoAR(total)}</strong>
                            </div>
                            {onCheckout ? (
                                <button
                                    className={styles.checkout}
                                    type="button"
                                    onClick={onCheckout}
                                    data-testid="cart-checkout"
                                >
                                    <span className={styles.checkoutCopy}>
                                        <Sparkles size={18} />
                                        Confirmar pedido
                                    </span>
                                    <ArrowUpRight size={18} />
                                </button>
                            ) : null}
                            <button
                                className={onCheckout ? styles.checkoutSecondary : styles.checkout}
                                type="button"
                                onClick={onWhatsApp}
                                data-testid="cart-whatsapp-fallback"
                            >
                                <span className={styles.checkoutCopy}>
                                    <MessageCircle size={18} />
                                    {onCheckout ? 'Solo WhatsApp (sin registrar)' : 'Pedir por WhatsApp'}
                                </span>
                                <ArrowUpRight size={18} />
                            </button>
                            <p className={styles.checkoutNote}>
                                {onCheckout
                                    ? 'Registramos el pedido en Ilara y después podés continuar por WhatsApp'
                                    : 'Continuás el pedido por WhatsApp'}
                            </p>
                        </footer>
                    </>
                ) : (
                    <div className={styles.empty}>
                        <span className={styles.emptyIcon}><ShoppingBag size={28} /></span>
                        <h3>Tu bolsa está esperando</h3>
                        <p>Volvé al catálogo para encontrar un nuevo favorito.</p>
                        <button className={styles.explore} type="button" onClick={onClose}>Explorar catálogo</button>
                    </div>
                )}
            </aside>
        </div>
    )
}
