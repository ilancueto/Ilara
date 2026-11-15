'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { OrderSummary } from '@/components/storefront/OrderSummary'
import { catalogDisplayComboPrice, catalogDisplayUnitPrice } from '@/lib/domain/payments/catalogDisplayPrice'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import { createCatalogOrderAction } from '@/app/actions/orders'
import { createFollowShareLinkAction, startBankTransferAction, startMercadoPagoAction } from '@/app/actions/payments'
import type { CatalogCartItem } from '@/hooks/useCarrito'
import type { CreateOrderResult } from '@/lib/domain/orders/types'
import { buildOrderWhatsAppMessage } from '@/lib/domain/orders/whatsappMessage'
import { openWhatsApp } from '@/lib/whatsappLink'
import { normalizePhoneDigits } from '@/lib/domain/orders/validation'
import {
  listShippingLocalities,
  listShippingProvinces,
  quoteShipping,
} from '@/lib/domain/shipping/browserShipping'
import type { ShippingLocation, ShippingQuote } from '@/lib/domain/shipping/types'
import { toUserMessage } from '@/lib/domain/errors'
import { FULFILLMENT_COPY, type FulfillmentMode } from '@/lib/domain/orders/fulfillment'
import { paymentStartKey, saveOrderAccess } from '@/lib/domain/payments/publicSession'
import styles from '@/components/storefront/storefront.module.css'
import { CheckoutExito } from './Checkout/CheckoutExito'
import { CheckoutDatosFields } from './Checkout/CheckoutDatosFields'
import { CheckoutEntrega } from './Checkout/CheckoutEntrega'

type Props = {
  open: boolean
  onClose: () => void
  onBack: () => void
  carrito: CatalogCartItem[]
  appliedCoupon: { code: string; discount_percentage: number } | null
  subtotal: number
  descuentoCupon: number
  total: number
  onOrderCreated: (order: CreateOrderResult) => void
  showToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void
}

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `idem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
}

export function CheckoutPedido({
  open,
  onClose,
  onBack,
  carrito,
  appliedCoupon,
  subtotal,
  descuentoCupon,
  total: _total,
  onOrderCreated,
  showToast,
}: Props) {
  void _total
  const panelRef = useRef<HTMLElement>(null)
  const formId = useId()
  useDialogA11y(open, onClose, panelRef)

  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [provinces, setProvinces] = useState<ShippingLocation[]>([])
  const [localities, setLocalities] = useState<ShippingLocation[]>([])
  const [provinceId, setProvinceId] = useState('')
  const [localityId, setLocalityId] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [street, setStreet] = useState('')
  const [streetNumber, setStreetNumber] = useState('')
  const [locationsPending, setLocationsPending] = useState(false)
  const [locationsError, setLocationsError] = useState<string | null>(null)
  const [shippingQuote, setShippingQuote] = useState<ShippingQuote | null>(null)
  const [selectedShippingId, setSelectedShippingId] = useState<string | null>(null)
  const [quotePending, setQuotePending] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [fulfillmentMode, setFulfillmentMode] = useState<FulfillmentMode>('envio')
  const [fulfillmentZone, setFulfillmentZone] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState<CreateOrderResult | null>(null)
  const [notifiedVia, setNotifiedVia] = useState<'email' | 'whatsapp' | 'none'>('none')
  const idemRef = useRef<string>(newIdempotencyKey())
  const submittingRef = useRef(false)
  const localityRequestRef = useRef(0)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (open && !done) {
      // Nueva apertura de checkout (sin confirmación previa): nueva clave.
      if (!submittingRef.current) {
        idemRef.current = newIdempotencyKey()
        setSubmitError(null)
        setFieldError(null)
      }
    }
  }, [open, done])

  useEffect(() => {
    if (!open || provinces.length) return
    let cancelled = false
    setLocationsPending(true)
    setLocationsError(null)
    void listShippingProvinces()
      .then((items) => {
        if (!cancelled) setProvinces(items)
      })
      .catch((error) => {
        if (!cancelled) {
          setLocationsError(toUserMessage(error, 'No se pudieron cargar las provincias.'))
        }
      })
      .finally(() => {
        if (!cancelled) setLocationsPending(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, provinces.length])

  if (!open) return null

  const selectedShipping = shippingQuote?.options.find((option) => option.id === selectedShippingId) || null
  const needsShippingQuote = fulfillmentMode === 'envio'
  const canSubmit = carrito.length > 0 && (!needsShippingQuote || Boolean(selectedShippingId))
  const addressComplete = Boolean(
    provinceId && localityId && /^\d{4}$/.test(postalCode)
    && street.trim().length >= 2 && /^\d{1,6}$/.test(streetNumber)
  )

  const invalidateQuote = () => {
    setShippingQuote(null)
    setSelectedShippingId(null)
    setQuoteError(null)
  }

  const handleProvinceChange = async (nextProvinceId: string) => {
    const requestId = ++localityRequestRef.current
    setProvinceId(nextProvinceId)
    setLocalityId('')
    setLocalities([])
    invalidateQuote()
    if (!nextProvinceId) return
    setLocationsPending(true)
    setLocationsError(null)
    try {
      const items = await listShippingLocalities(nextProvinceId)
      if (localityRequestRef.current === requestId) setLocalities(items)
    } catch (error) {
      if (localityRequestRef.current === requestId) {
        setLocationsError(toUserMessage(error, 'No se pudieron cargar las localidades.'))
      }
    } finally {
      if (localityRequestRef.current === requestId) setLocationsPending(false)
    }
  }

  const handleQuote = async () => {
    if (quotePending || pending) return
    setQuotePending(true)
    setQuoteError(null)
    setShippingQuote(null)
    setSelectedShippingId(null)
    try {
      const result = await quoteShipping({
        provinceId,
        localityId,
        postalCode,
        street,
        number: streetNumber,
      })
      setShippingQuote(result)
      setSelectedShippingId(result.options[0]?.id || null)
    } catch (error) {
      setQuoteError(toUserMessage(error, 'No pudimos mostrar opciones de envío. Intentá de nuevo.'))
    } finally {
      setQuotePending(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pending || submittingRef.current || done) return

    const trimmedName = name.trim()
    const digits = normalizePhoneDigits(phone)
    if (!trimmedName) {
      setFieldError('Ingresá tu nombre.')
      document.getElementById(`${formId}-name`)?.focus()
      return
    }
    if (digits.length < 8 || digits.length > 15) {
      setFieldError('Ingresá un teléfono válido (8 a 15 dígitos).')
      document.getElementById(`${formId}-phone`)?.focus()
      return
    }
    if (needsShippingQuote && (!selectedShippingId || !selectedShipping)) {
      setFieldError('Cotizá el envío y elegí una opción antes de confirmar.')
      return
    }
    setFieldError(null)
    setSubmitError(null)
    submittingRef.current = true

    const lines = carrito
      .map((item) => {
        if (item.producto) {
          return {
            line_type: 'product' as const,
            product_id: item.producto.id,
            quantity: item.cantidad,
          }
        }
        if (item.combo) {
          return {
            line_type: 'combo' as const,
            combo_id: item.combo.id,
            quantity: item.cantidad,
          }
        }
        return null
      })
      .filter((x): x is NonNullable<typeof x> => x != null)

    startTransition(async () => {
      try {
        const result = await createCatalogOrderAction(
          {
            idempotency_key: idemRef.current,
            fulfillment_mode: fulfillmentMode,
            shipping_quote_id: needsShippingQuote ? selectedShippingId : null,
            fulfillment_zone: fulfillmentMode === 'coordinar' ? fulfillmentZone.trim() || null : null,
            customer_name: trimmedName,
            customer_phone: digits,
            customer_email: email.trim() || null,
            notes: notes.trim() || null,
            coupon_code: appliedCoupon?.code ?? null,
            lines,
          },
          {
            lines: carrito.map((item) => ({
              name: item.producto ? item.producto.name : item.combo!.name,
              quantity: item.cantidad,
            })),
          }
        )

        if (!result.ok) {
          setSubmitError(result.error)
          showToast('error', result.error)
          // Mantener carrito y misma clave para reintento seguro si es red; si validación, nueva clave.
          if (!result.retryable) {
            idemRef.current = newIdempotencyKey()
          }
          return
        }

        if (result.order.access_capability) {
          saveOrderAccess(
            result.order.order_number,
            result.order.access_capability,
            result.order.follow_token
          )
        }
        setDone(result.order)
        setNotifiedVia(result.notifiedVia)
        onOrderCreated(result.order)
        showToast('success', `Pedido ${result.order.order_number} creado`)
      } catch {
        setSubmitError('No se pudo crear el pedido. Revisá tu conexión e intentá de nuevo.')
        showToast('error', 'Error de conexión. Tu bolsa se conservó.')
      } finally {
        submittingRef.current = false
      }
    })
  }

  const openWa = () => {
    if (!done) return
    startTransition(async () => {
      const link = await createFollowShareLinkAction(done.order_number)
      const lines = carrito.map((item) => ({
        name: item.producto ? item.producto.name : item.combo!.name,
        quantity: item.cantidad,
      }))
      const msg = buildOrderWhatsAppMessage({
        order_number: done.order_number,
        total: done.total,
        lines,
        customer_name: name.trim(),
        fulfillment_mode: done.fulfillment_mode ?? fulfillmentMode,
        follow_url: link.ok ? link.data.url : null,
      })
      if (!openWhatsApp(msg, false)) {
        showToast('warning', 'No se pudo abrir WhatsApp. Tu pedido ya está confirmado.')
      }
    })
  }

  const payMercadoPago = () => {
    const access = done?.access_capability
    if (!access) return
    startTransition(async () => {
      const result = await startMercadoPagoAction(
        access,
        paymentStartKey('mercado_pago', Boolean(submitError))
      )
      if (!result.ok) {
        setSubmitError(result.error)
        showToast('error', result.error)
        return
      }
      window.location.assign(result.data.checkout_url)
    })
  }

  const payTransfer = () => {
    const access = done?.access_capability
    if (!access) return
    startTransition(async () => {
      const result = await startBankTransferAction(
        access,
        paymentStartKey('bank_transfer', Boolean(submitError))
      )
      if (!result.ok) {
        setSubmitError(result.error)
        showToast('error', result.error)
        return
      }
      router.push('/pedido')
    })
  }

  const summaryItems = carrito.map((item) => ({
    name: item.producto ? item.producto.name : item.combo!.name,
    quantity: item.cantidad,
    unitPrice: item.producto ? catalogDisplayUnitPrice(item.producto) : catalogDisplayComboPrice(item.combo!),
  }))
  const shippingKnown = !needsShippingQuote || Boolean(selectedShipping)
  const shippingLabel = !needsShippingQuote
    ? FULFILLMENT_COPY[fulfillmentMode].title
    : selectedShipping
      ? `${selectedShipping.carrier} · ${selectedShipping.service}`
      : 'A calcular'
  const summary = (
    <OrderSummary
      items={summaryItems}
      productsTotal={subtotal}
      couponCode={appliedCoupon?.code}
      couponDiscount={descuentoCupon}
      shippingLabel={shippingLabel}
      shippingAmount={!needsShippingQuote ? 0 : selectedShipping?.amount ?? null}
      showFinalTotal={shippingKnown}
      note="Se crea un pedido. El pago es el paso siguiente."
    />
  )

  return (
    <div className={`storefront ${styles.checkoutOverlay}`}>
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
        className={styles.checkoutPage}
        data-testid="checkout-pedido"
      >
        <p className={styles.crumb}>
          {!done ? (
            <button type="button" className={styles.comboLink} onClick={onBack} disabled={pending} aria-label="Volver a la bolsa">
              <ArrowLeft size={16} /> Volver a la bolsa
            </button>
          ) : null}
        </p>
        <h1 id={`${formId}-title`}>{done ? 'Elegí cómo pagar' : 'Completemos tu pedido'}</h1>
        <p className={styles.steps}>
          {done ? <>1. Datos y entrega &nbsp; → &nbsp; <b>2. Pago</b></> : <><b>1. Datos y entrega</b> &nbsp; → &nbsp; 2. Pago</>}
        </p>

        {done ? (
          <CheckoutExito
            done={done}
            notifiedVia={notifiedVia}
            fulfillmentMode={fulfillmentMode}
            pending={pending}
            onPayMercadoPago={payMercadoPago}
            onPayTransfer={payTransfer}
            onWhatsApp={openWa}
            onClose={onClose}
          />
        ) : (
          <form className={styles.checkoutGrid} onSubmit={handleSubmit} noValidate>
            
            <div>
            <CheckoutDatosFields
              formId={formId}
              pending={pending}
              name={name}
              setName={setName}
              phone={phone}
              setPhone={setPhone}
              email={email}
              setEmail={setEmail}
            />

            {/* Section 2: Delivery Method */}
            <CheckoutEntrega
              formId={formId}
              pending={pending}
              fulfillmentMode={fulfillmentMode}
              setFulfillmentMode={setFulfillmentMode}
              setFieldError={setFieldError}
              fulfillmentZone={fulfillmentZone}
              setFulfillmentZone={setFulfillmentZone}
              needsShippingQuote={needsShippingQuote}
              invalidateQuote={invalidateQuote}
              provinces={provinces}
              provinceId={provinceId}
              handleProvinceChange={handleProvinceChange}
              localities={localities}
              localityId={localityId}
              setLocalityId={setLocalityId}
              locationsPending={locationsPending}
              locationsError={locationsError}
              street={street}
              setStreet={setStreet}
              streetNumber={streetNumber}
              setStreetNumber={setStreetNumber}
              postalCode={postalCode}
              setPostalCode={setPostalCode}
              addressComplete={addressComplete}
              quotePending={quotePending}
              quoteError={quoteError}
              handleQuote={handleQuote}
              shippingQuote={shippingQuote}
              selectedShippingId={selectedShippingId}
              setSelectedShippingId={setSelectedShippingId}
            />

            {/* Notes */}
            <div className={styles.field}>
              <label htmlFor={`${formId}-notes`}>Notas o aclaraciones (opcional)</label>
              <textarea
                id={`${formId}-notes`}
                name="notes"
                maxLength={500}
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={pending}
                data-testid="checkout-notes"
                placeholder={
                  fulfillmentMode === 'retiro'
                    ? 'Horario estimado para retirar...'
                    : 'Piso, depto, timbre o indicaciones...'
                }
              />
            </div>

            {(fieldError || submitError) && (
              <p className={styles.errorText} role="alert" data-testid="checkout-error">
                {fieldError || submitError}
              </p>
            )}

            <p className={styles.notice}>Se crea un pedido. El pago es el paso siguiente.</p>

            <button
              type="submit"
              className={`${styles.primaryBtn} ${styles.wide}`}
              disabled={pending || quotePending || !canSubmit}
              data-testid="checkout-submit"
              aria-busy={pending}
            >
              {pending ? (
                <>
                  <Loader2 size={18} className={styles.spin} aria-hidden />
                  <span>Creando pedido…</span>
                </>
              ) : (
                <span>Crear pedido y continuar al pago</span>
              )}
            </button>
            </div>

            <aside className={`${styles.box} ${styles.side}`} aria-label="Resumen">
              <details open>
                <summary>Resumen del pedido</summary>
                {summary}
              </details>
            </aside>
          </form>
        )}
      </section>
    </div>
  )
}
