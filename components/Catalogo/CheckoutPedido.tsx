'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { ArrowLeft, CheckCircle2, Loader2, MessageCircle, Truck } from 'lucide-react'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import { createCatalogOrderAction } from '@/app/actions/orders'
import type { CatalogCartItem } from '@/hooks/useCarrito'
import type { CreateOrderResult } from '@/lib/domain/orders/types'
import { buildOrderWhatsAppMessage } from '@/lib/domain/orders/whatsappMessage'
import { openWhatsApp } from '@/lib/whatsappLink'
import { formatPesoAR, formatPesoARExact } from '@/lib/formatPesoAR'
import { normalizePhoneDigits } from '@/lib/domain/orders/validation'
import { quoteShipping } from '@/lib/domain/shipping/browserShipping'
import type { ShippingQuote } from '@/lib/domain/shipping/types'
import { toUserMessage } from '@/lib/domain/errors'
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
  const [postalCode, setPostalCode] = useState('')
  const [shippingQuote, setShippingQuote] = useState<ShippingQuote | null>(null)
  const [selectedShippingId, setSelectedShippingId] = useState<string | null>(null)
  const [quotePending, setQuotePending] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState<CreateOrderResult | null>(null)
  const idemRef = useRef<string>(newIdempotencyKey())
  const submittingRef = useRef(false)

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

  if (!open) return null

  const selectedShipping = shippingQuote?.options.find((option) => option.id === selectedShippingId) || null
  const estimatedTotal = total + (selectedShipping?.amount || 0)

  const handleQuote = async () => {
    if (quotePending || pending) return
    setQuotePending(true)
    setQuoteError(null)
    setShippingQuote(null)
    setSelectedShippingId(null)
    try {
      const result = await quoteShipping(postalCode)
      setShippingQuote(result)
      setSelectedShippingId(result.options[0]?.id || null)
    } catch (error) {
      setQuoteError(toUserMessage(error, 'No se pudo cotizar el envío. Intentá de nuevo.'))
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
    if (!selectedShippingId || !selectedShipping) {
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
          shipping_quote_id: selectedShippingId,
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

        setDone(result.order)
        onOrderCreated(result.order)
        showToast('success', `Pedido ${result.order.order_number} registrado`)
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
    const msg = buildOrderWhatsAppMessage({
      order_number: done.order_number,
      total: done.total,
      lines,
      customer_name: name.trim(),
    })
    const ok = openWhatsApp(msg, false)
    if (!ok) {
      showToast('warning', 'No se pudo abrir WhatsApp. Tu pedido ya quedó registrado.')
    }
  }

  return (
    <div className={styles.overlay}>
      <button
        className={styles.backdrop}
        type="button"
        onClick={pending ? undefined : onClose}
        aria-label="Cerrar checkout"
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
            <p className={styles.eyebrow}>{done ? 'Confirmación' : 'Checkout'}</p>
            <h2 id={`${formId}-title`} className={styles.title}>
              {done ? 'Pedido registrado' : 'Datos del pedido'}
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
              Envío: {done.shipping_carrier} · {done.shipping_service}
              {done.shipping_delivery_estimate ? ` · ${done.shipping_delivery_estimate}` : ''}.<br />
              Destino: CP {done.shipping_destination_postal_code}, {done.shipping_destination_city}.
            </p>
            <button
              type="button"
              className={styles.primary}
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
              {selectedShipping && (
                <div className={styles.summaryRow}>
                  <span>Envío</span>
                  <span>${formatPesoARExact(selectedShipping.amount)}</span>
                </div>
              )}
              <div className={styles.summaryTotal}>
                <span>Total estimado</span>
                <strong>${formatPesoARExact(estimatedTotal)}</strong>
              </div>
              <p className={styles.note}>El sistema revalida productos, cupón y tarifa al confirmar.</p>
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
            <div className={styles.field}>
              <label htmlFor={`${formId}-postal-code`}>Código postal de destino *</label>
              <div className={styles.quoteRow}>
                <input
                  id={`${formId}-postal-code`}
                  name="postal_code"
                  type="text"
                  autoComplete="postal-code"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  value={postalCode}
                  onChange={(e) => {
                    const next = e.target.value.replace(/\D/g, '').slice(0, 4)
                    setPostalCode(next)
                    if (shippingQuote?.destination.postalCode !== next) {
                      setShippingQuote(null)
                      setSelectedShippingId(null)
                    }
                    setQuoteError(null)
                  }}
                  required
                  disabled={pending || quotePending}
                  data-testid="checkout-postal-code"
                />
                <button
                  type="button"
                  className={styles.quoteButton}
                  onClick={() => void handleQuote()}
                  disabled={pending || quotePending || postalCode.length !== 4}
                  data-testid="checkout-quote-shipping"
                >
                  {quotePending ? <Loader2 size={16} className={styles.spin} aria-hidden /> : <Truck size={16} aria-hidden />}
                  {quotePending ? 'Cotizando…' : 'Cotizar'}
                </button>
              </div>
              <p className={styles.fieldHint}>Origen: Neuquén 8300 · bolsa 20 × 35 × 5 cm · hasta 1 kg.</p>
            </div>

            {quoteError && <p className={styles.error} role="alert" data-testid="shipping-quote-error">{quoteError}</p>}

            {shippingQuote && (
              <fieldset className={styles.shippingOptions} data-testid="shipping-options">
                <legend>Elegí el envío *</legend>
                <p className={styles.destination}>
                  {shippingQuote.destination.city}, {shippingQuote.destination.state} · CP {shippingQuote.destination.postalCode}
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
                <p className={styles.fieldHint}>Tarifa válida por 15 minutos.</p>
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
                placeholder="Horario preferido, retiro, etc."
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
              disabled={pending || quotePending || carrito.length === 0 || !selectedShippingId}
              data-testid="checkout-submit"
              aria-busy={pending}
            >
              {pending ? (
                <>
                  <Loader2 size={18} className={styles.spin} aria-hidden />
                  Registrando…
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
