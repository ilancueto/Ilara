'use client'

import { Loader2, Truck } from 'lucide-react'
import { FULFILLMENT_COPY, type FulfillmentMode } from '@/lib/domain/orders/fulfillment'
import { formatPesoARExact } from '@/lib/formatPesoAR'
import type { ShippingLocation, ShippingQuote } from '@/lib/domain/shipping/types'
import styles from '@/components/storefront/storefront.module.css'

type Props = {
  formId: string
  pending: boolean
  fulfillmentMode: FulfillmentMode
  setFulfillmentMode: (mode: FulfillmentMode) => void
  setFieldError: (value: string | null) => void
  fulfillmentZone: string
  setFulfillmentZone: (value: string) => void
  needsShippingQuote: boolean
  invalidateQuote: () => void
  provinces: ShippingLocation[]
  provinceId: string
  handleProvinceChange: (provinceId: string) => Promise<void>
  localities: ShippingLocation[]
  localityId: string
  setLocalityId: (value: string) => void
  locationsPending: boolean
  locationsError: string | null
  street: string
  setStreet: (value: string) => void
  streetNumber: string
  setStreetNumber: (value: string) => void
  postalCode: string
  setPostalCode: (value: string) => void
  addressComplete: boolean
  quotePending: boolean
  quoteError: string | null
  handleQuote: () => Promise<void>
  shippingQuote: ShippingQuote | null
  selectedShippingId: string | null
  setSelectedShippingId: (value: string | null) => void
}

/** Modalidad de entrega, dirección y cotización de envío. */
export function CheckoutEntrega({
  formId, pending, fulfillmentMode, setFulfillmentMode, setFieldError, fulfillmentZone, setFulfillmentZone,
  needsShippingQuote, invalidateQuote, provinces, provinceId, handleProvinceChange, localities, localityId,
  setLocalityId, locationsPending, locationsError, street, setStreet, streetNumber, setStreetNumber, postalCode,
  setPostalCode, addressComplete, quotePending, quoteError, handleQuote, shippingQuote, selectedShippingId,
  setSelectedShippingId,
}: Props) {
  return (
      <div className={styles.box} style={{ marginTop: 18 }}>
        <h2>¿Cómo lo recibís?</h2>

        <fieldset data-testid="fulfillment-options">
          {(Object.keys(FULFILLMENT_COPY) as FulfillmentMode[]).map((mode) => (
            <label key={mode} className={styles.choice}>
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
              <span>
                <strong>{FULFILLMENT_COPY[mode].title}</strong>
                <small>{FULFILLMENT_COPY[mode].hint}</small>
              </span>
            </label>
          ))}
        </fieldset>

        {fulfillmentMode === 'coordinar' && (
          <div className={styles.field} style={{ marginTop: '0.5rem' }}>
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
          <fieldset disabled={pending || quotePending}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 7rem', gap: 12 }}>
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
                  placeholder="Calle"
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
                  placeholder="Nro"
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
                placeholder="Ej: 1425"
                required
                data-testid="checkout-postal-code"
              />
            </div>
            <div>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => void handleQuote()}
                disabled={pending || quotePending || locationsPending || !addressComplete}
                data-testid="checkout-quote-shipping"
              >
                {quotePending ? <Loader2 size={16} className={styles.spin} aria-hidden /> : <Truck size={16} aria-hidden />}
                {quotePending ? 'Cotizando…' : 'Calcular opciones de envío'}
              </button>
            </div>
          </fieldset>
        )}

        {locationsError && <p className={styles.errorText} role="alert">{locationsError}</p>}
        {quoteError && <p className={styles.errorText} role="alert" data-testid="shipping-quote-error">{quoteError}</p>}

        {shippingQuote && (
          <fieldset data-testid="shipping-options" style={{ marginTop: '0.5rem' }}>
            <legend>Opciones de envío</legend>
            <p className={styles.muted}>
              {shippingQuote.destination.formattedAddress} · CP {shippingQuote.destination.postalCode}
            </p>
            {shippingQuote.options.map((option) => (
              <label key={option.id} className={styles.choice}>
                <input
                  type="radio"
                  name="shipping_option"
                  value={option.id}
                  checked={selectedShippingId === option.id}
                  onChange={() => setSelectedShippingId(option.id)}
                  disabled={pending}
                />
                <span>
                  <strong>{option.carrier} · {option.service}</strong>
                  <small>{option.deliveryEstimate || 'Plazo a confirmar'}</small>
                </span>
                <strong style={{ fontFamily: 'var(--font-mono)' }}>${formatPesoARExact(option.amount)}</strong>
              </label>
            ))}
          </fieldset>
        )}
      </div>
  )
}
