'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Loader2, MessageCircle, Truck } from 'lucide-react'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import { createCatalogOrderAction } from '@/app/actions/orders'
import type { CatalogCartItem } from '@/hooks/useCarrito'
import type { CreateOrderResult } from '@/lib/domain/orders/types'
import { buildOrderWhatsAppMessage } from '@/lib/domain/orders/whatsappMessage'
import { openWhatsApp } from '@/lib/whatsappLink'
import { formatPesoAR, formatPesoARExact } from '@/lib/formatPesoAR'
import { normalizePhoneDigits } from '@/lib/domain/orders/validation'
import {
  listShippingLocalities,
  listShippingProvinces,
  quoteShipping,
} from '@/lib/domain/shipping/browserShipping'
import type { ShippingLocation, ShippingQuote } from '@/lib/domain/shipping/types'
import { toUserMessage } from '@/lib/domain/errors'
import { FULFILLMENT_COPY, type FulfillmentMode } from '@/lib/domain/orders/fulfillment'
import { saveOrderAccess } from '@/lib/domain/payments/publicSession'
import { buildOrderFollowCleanPath, buildOrderFollowUrl } from '@/lib/domain/orders/followLink'
import styles from '@/components/Catalogo/CheckoutPedido.module.css'

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
  total,
  onOrderCreated,
  showToast,
}: Props) {
  const panelRef = useRef<HTMLElement>(null)
  const formId = useId()
  useDialogA11y(open, onClose, panelRef)

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
  const estimatedTotal = total + (needsShippingQuote ? (selectedShipping?.amount || 0) : 0)
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
      return
    }
    if (digits.length < 8 || digits.length > 15) {
      setFieldError('Ingresá un teléfono válido (8 a 15 dígitos).')
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
        const result = await createCatalogOrderAction({
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
        })

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
          saveOrderAccess(result.order.order_number, result.order.access_capability)
        }
        setDone(result.order)
        onOrderCreated(result.order)
        showToast('success', `Pedido ${result.order.order_number} confirmado`)
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
    const lines = carrito.map((item) => ({
      name: item.producto ? item.producto.name : item.combo!.name,
      quantity: item.cantidad,
    }))
    const followUrl = done.follow_token
      ? buildOrderFollowUrl(done.order_number, done.follow_token)
      : null
    const msg = buildOrderWhatsAppMessage({
      order_number: done.order_number,
      total: done.total,
      lines,
      customer_name: name.trim(),
      fulfillment_mode: done.fulfillment_mode ?? fulfillmentMode,
      follow_url: followUrl,
    })
    const ok = openWhatsApp(msg, false)
    if (!ok) {
      showToast('warning', 'No se pudo abrir WhatsApp. Tu pedido ya está confirmado.')
    }
  }

  return (
    <div className={styles.overlay}>
      <button
        className={styles.backdrop}
        type="button"
        onClick={pending ? undefined : onClose}
        aria-label="Cerrar pedido"
        disabled={pending}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-title`}
        className={styles.drawer}
        data-testid="checkout-pedido"
      >
        <header className={styles.head}>
          {!done && (
            <button
              type="button"
              className={styles.back}
              onClick={onBack}
              disabled={pending}
              aria-label="Volver a la bolsa"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <p className={styles.eyebrow}>{done ? 'Confirmación' : 'Tu pedido'}</p>
            <h2 id={`${formId}-title`} className={styles.title}>
              {done ? '¡Pedido confirmado!' : 'Datos del pedido'}
            </h2>
          </div>
        </header>

        {done ? (
          <div className={styles.success} data-testid="checkout-success">
            <CheckCircle2 className={styles.successIcon} size={40} aria-hidden />
            <p className={styles.orderNumberLabel}>Número de pedido</p>
            <p className={styles.orderNumber} data-testid="order-number">
              {done.order_number}
            </p>
            <p className={styles.successTotal}>
              Total: <strong>${formatPesoARExact(done.total)}</strong>
            </p>
            <p className={styles.hint}>
              {done.fulfillment_mode === 'envio' ? (
                <>
                  Envío: {done.shipping_carrier} · {done.shipping_service}
                  {done.shipping_delivery_estimate ? ` · ${done.shipping_delivery_estimate}` : ''}.<br />
                  Destino: {done.shipping_destination_formatted_address || `${done.shipping_destination_city}, ${done.shipping_destination_state}`}
                  {done.shipping_destination_postal_code ? ` · CP ${done.shipping_destination_postal_code}` : ''}.
                </>
              ) : (
                FULFILLMENT_COPY[done.fulfillment_mode || fulfillmentMode].success
              )}
            </p>
            {done.follow_token && (
              <p className={styles.hint} data-testid="checkout-follow-link">
                Guardá este enlace para ver el estado del pedido:
                <br />
                <span className={styles.followUrl}>{buildOrderFollowUrl(done.order_number, done.follow_token)}</span>
              </p>
            )}
            {done.follow_token && (
              <button
                type="button"
                className={styles.secondary}
                data-testid="checkout-copy-follow"
                onClick={() => {
                  const url = buildOrderFollowUrl(done.order_number, done.follow_token!)
                  void navigator.clipboard?.writeText(url).then(
                    () => showToast('success', 'Enlace copiado'),
                    () => showToast('warning', 'No se pudo copiar. Seleccioná el enlace a mano.'),
                  )
                }}
              >
                Copiar enlace
              </button>
            )}
            {(done.follow_token || done.access_capability) && (
              <Link
                href={done.follow_token ? buildOrderFollowCleanPath(done.order_number) : '/pedido'}
                className={styles.primary}
                data-testid="checkout-continue-payment"
              >
                Pagar
              </Link>
            )}
            {done.follow_token && (
              <Link
                href={buildOrderFollowCleanPath(done.order_number)}
                className={styles.secondary}
                data-testid="checkout-pay-transfer"
              >
                Pagar por transferencia
              </Link>
            )}
            <button
              type="button"
              className={done.access_capability ? styles.secondary : styles.primary}
              onClick={openWa}
              data-testid="checkout-whatsapp"
            >
              <MessageCircle size={18} />
              Continuar por WhatsApp
            </button>
            <button type="button" className={styles.secondary} onClick={onClose}>
              Seguir mirando el catálogo
            </button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <section className={styles.summary} aria-label="Resumen">
              <div className={styles.summaryRow}>
                <span>Subtotal</span>
                <span>${formatPesoAR(subtotal)}</span>
              </div>
              {appliedCoupon && (
                <div className={styles.summaryRow}>
                  <span>Cupón {appliedCoupon.code}</span>
                  <span>−${formatPesoAR(descuentoCupon)}</span>
                </div>
              )}
              <div className={styles.summaryTotal}>
                <span>Productos</span>
                <strong>${formatPesoAR(total)}</strong>
              </div>
              {needsShippingQuote && selectedShipping && (
                <div className={styles.summaryRow}>
                  <span>Envío</span>
                  <span>${formatPesoARExact(selectedShipping.amount)}</span>
                </div>
              )}
              {!needsShippingQuote && (
                <div className={styles.summaryRow}>
                  <span>{FULFILLMENT_COPY[fulfillmentMode].title}</span>
                  <span>Sin cargo de envío</span>
                </div>
              )}
              <div className={styles.summaryTotal}>
                <span>Total</span>
                <strong>${formatPesoARExact(estimatedTotal)}</strong>
              </div>
            </section>

            <div className={styles.field}>
              <label htmlFor={`${formId}-name`}>Nombre *</label>
              <input
                id={`${formId}-name`}
                name="customer_name"
                type="text"
                autoComplete="name"
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={pending}
                data-testid="checkout-name"
              />
            </div>
            <div className={styles.field}>
              <label htmlFor={`${formId}-phone`}>Teléfono / WhatsApp *</label>
              <input
                id={`${formId}-phone`}
                name="customer_phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                maxLength={20}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={pending}
                data-testid="checkout-phone"
                aria-describedby={`${formId}-phone-hint`}
              />
              <p id={`${formId}-phone-hint`} className={styles.fieldHint}>
                Solo números, con código de área (ej. 299…)
              </p>
            </div>
            <div className={styles.field}>
              <label htmlFor={`${formId}-email`}>Email (opcional)</label>
              <input
                id={`${formId}-email`}
                name="customer_email"
                type="email"
                autoComplete="email"
                maxLength={120}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={pending}
                data-testid="checkout-email"
              />
            </div>
            <fieldset className={styles.shippingOptions} data-testid="fulfillment-options">
              <legend>¿Cómo lo recibís? *</legend>
              {(Object.keys(FULFILLMENT_COPY) as FulfillmentMode[]).map((mode) => (
                <label key={mode} className={styles.shippingOption}>
                  <input
                    type="radio"
                    name="fulfillment_mode"
                    value={mode}
                    checked={fulfillmentMode === mode}
                    onChange={() => {
                      setFulfillmentMode(mode)
                      setFieldError(null)
                      if (mode !== 'envio') invalidateQuote()
                    }}
                    disabled={pending}
                    data-testid={`fulfillment-${mode}`}
                  />
                  <span className={styles.shippingCopy}>
                    <strong>{FULFILLMENT_COPY[mode].title}</strong>
                    <small>{FULFILLMENT_COPY[mode].hint}</small>
                  </span>
                </label>
              ))}
            </fieldset>

            {fulfillmentMode === 'coordinar' && (
              <div className={styles.field}>
                <label htmlFor={`${formId}-zone`}>Zona o ciudad (opcional)</label>
                <input
                  id={`${formId}-zone`}
                  name="fulfillment_zone"
                  type="text"
                  maxLength={80}
                  value={fulfillmentZone}
                  onChange={(e) => setFulfillmentZone(e.target.value)}
                  disabled={pending}
                  data-testid="checkout-fulfillment-zone"
                  placeholder="Ej. centro, Plottier…"
                />
              </div>
            )}

            {needsShippingQuote && (
            <fieldset className={styles.addressFields} disabled={pending || quotePending}>
              <legend>Dirección de entrega *</legend>
              <div className={styles.field}>
                <label htmlFor={`${formId}-province`}>Provincia</label>
                <select
                  id={`${formId}-province`}
                  name="province"
                  value={provinceId}
                  onChange={(e) => void handleProvinceChange(e.target.value)}
                  required
                  data-testid="checkout-province"
                >
                  <option value="">Elegí una provincia</option>
                  {provinces.map((province) => (
                    <option key={province.id} value={province.id}>{province.name}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor={`${formId}-locality`}>Ciudad / localidad</label>
                <select
                  id={`${formId}-locality`}
                  name="locality"
                  value={localityId}
                  onChange={(e) => {
                    setLocalityId(e.target.value)
                    invalidateQuote()
                  }}
                  required
                  disabled={!provinceId || locationsPending || pending || quotePending}
                  data-testid="checkout-locality"
                >
                  <option value="">{locationsPending ? 'Cargando…' : 'Elegí una localidad'}</option>
                  {localities.map((locality) => (
                    <option key={locality.id} value={locality.id}>
                      {locality.name}{locality.department ? ` · ${locality.department}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.addressRow}>
                <div className={styles.field}>
                  <label htmlFor={`${formId}-street`}>Calle</label>
                  <input
                    id={`${formId}-street`}
                    name="street"
                    type="text"
                    autoComplete="address-line1"
                    maxLength={120}
                    value={street}
                    onChange={(e) => {
                      setStreet(e.target.value)
                      invalidateQuote()
                    }}
                    required
                    data-testid="checkout-street"
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor={`${formId}-street-number`}>Altura</label>
                  <input
                    id={`${formId}-street-number`}
                    name="street_number"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{1,6}"
                    maxLength={6}
                    value={streetNumber}
                    onChange={(e) => {
                      setStreetNumber(e.target.value.replace(/\D/g, '').slice(0, 6))
                      invalidateQuote()
                    }}
                    required
                    data-testid="checkout-street-number"
                  />
                </div>
              </div>
              <div className={styles.field}>
                <label htmlFor={`${formId}-postal-code`}>Código postal</label>
                <input
                  id={`${formId}-postal-code`}
                  name="postal_code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  value={postalCode}
                  onChange={(e) => {
                    setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 4))
                    invalidateQuote()
                  }}
                  required
                  data-testid="checkout-postal-code"
                />
              </div>
              <div className={styles.quoteRow}>
                <button
                  type="button"
                  className={styles.quoteButton}
                  onClick={() => void handleQuote()}
                  disabled={pending || quotePending || locationsPending || !addressComplete}
                  data-testid="checkout-quote-shipping"
                >
                  {quotePending ? <Loader2 size={16} className={styles.spin} aria-hidden /> : <Truck size={16} aria-hidden />}
                  {quotePending ? 'Buscando…' : 'Ver envíos'}
                </button>
              </div>
            </fieldset>
            )}

            {locationsError && <p className={styles.error} role="alert">{locationsError}</p>}
            {quoteError && <p className={styles.error} role="alert" data-testid="shipping-quote-error">{quoteError}</p>}

            {shippingQuote && (
              <fieldset className={styles.shippingOptions} data-testid="shipping-options">
                <legend>Elegí el envío *</legend>
                <p className={styles.destination}>
                  {shippingQuote.destination.formattedAddress} · CP {shippingQuote.destination.postalCode}
                </p>
                {shippingQuote.options.map((option) => (
                  <label key={option.id} className={styles.shippingOption}>
                    <input
                      type="radio"
                      name="shipping_option"
                      value={option.id}
                      checked={selectedShippingId === option.id}
                      onChange={() => setSelectedShippingId(option.id)}
                      disabled={pending}
                    />
                    <span className={styles.shippingCopy}>
                      <strong>{option.carrier} · {option.service}</strong>
                      <small>{option.deliveryEstimate || 'Plazo a confirmar'}</small>
                    </span>
                    <strong>${formatPesoARExact(option.amount)}</strong>
                  </label>
                ))}
              </fieldset>
            )}

            <div className={styles.field}>
              <label htmlFor={`${formId}-notes`}>Notas (opcional)</label>
              <textarea
                id={`${formId}-notes`}
                name="notes"
                maxLength={500}
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={pending}
                data-testid="checkout-notes"
                placeholder={
                  fulfillmentMode === 'retiro'
                    ? 'Horario en el que podrías pasar'
                    : fulfillmentMode === 'coordinar'
                      ? 'Zona, horario o cómo preferís coordinar'
                      : 'Horario preferido, referencias, etc.'
                }
              />
            </div>

            {(fieldError || submitError) && (
              <p className={styles.error} role="alert" data-testid="checkout-error">
                {fieldError || submitError}
              </p>
            )}

            <button
              type="submit"
              className={styles.primary}
              disabled={pending || quotePending || !canSubmit}
              data-testid="checkout-submit"
              aria-busy={pending}
            >
              {pending ? (
                <>
                  <Loader2 size={18} className={styles.spin} aria-hidden />
                  Confirmando…
                </>
              ) : (
                'Confirmar pedido'
              )}
            </button>
          </form>
        )}
      </aside>
    </div>
  )
}
