'use client'

import { CheckCircle2, MessageCircle } from 'lucide-react'
import type { CreateOrderResult } from '@/lib/domain/orders/types'
import { FULFILLMENT_COPY, type FulfillmentMode } from '@/lib/domain/orders/fulfillment'
import { formatPesoARExact } from '@/lib/formatPesoAR'
import styles from '@/components/storefront/storefront.module.css'

type Props = {
  done: CreateOrderResult
  notifiedVia: 'email' | 'whatsapp' | 'none'
  fulfillmentMode: FulfillmentMode
  pending: boolean
  onPayMercadoPago: () => void
  onPayTransfer: () => void
  onWhatsApp: () => void
  onClose: () => void
}

/** Paso 2 del checkout: pedido creado y elección del medio de pago. */
export function CheckoutExito({
  done, notifiedVia, fulfillmentMode, pending, onPayMercadoPago, onPayTransfer, onWhatsApp, onClose,
}: Props) {
  return (
      <div className={styles.center} data-testid="checkout-success">
        <div className={styles.box}>
          <CheckCircle2 size={28} aria-hidden />
          <p className={styles.muted}>Pedido creado</p>
          <p data-testid="order-number" style={{ fontSize: 28, fontWeight: 550, margin: '8px 0' }}>
            {done.order_number}
          </p>
          <p>Importe: <strong>${formatPesoARExact(done.total)}</strong></p>
          <p className={styles.muted}>
            {done.fulfillment_mode === 'envio' ? (
              <>
                Envío: <strong>{done.shipping_carrier} · {done.shipping_service}</strong>
                {done.shipping_delivery_estimate ? ` (${done.shipping_delivery_estimate})` : ''}.{' '}
                Destino: {done.shipping_destination_formatted_address || `${done.shipping_destination_city}, ${done.shipping_destination_state}`}
                {done.shipping_destination_postal_code ? ` · CP ${done.shipping_destination_postal_code}` : ''}.
              </>
            ) : (
              FULFILLMENT_COPY[done.fulfillment_mode || fulfillmentMode].success
            )}
          </p>
          <p className={styles.muted} data-testid="checkout-notify">
            {notifiedVia === 'email'
              ? 'Te enviamos por email una confirmación con un enlace seguro de seguimiento.'
              : 'El pedido ya está creado. Elegí cómo pagar. Si el email no llegó, no vuelvas a enviarlo.'}
          </p>
          {done.access_capability && (
            <div data-testid="checkout-pay">
              <button
                type="button"
                className={`${styles.primaryBtn} ${styles.wide}`}
                disabled={pending}
                data-testid="checkout-pay-mp"
                onClick={onPayMercadoPago}
              >
                Pagar con Mercado Pago
              </button>
              <button
                type="button"
                className={`${styles.secondaryBtn} ${styles.wide}`}
                disabled={pending}
                data-testid="checkout-pay-transfer"
                style={{ marginTop: 10 }}
                onClick={onPayTransfer}
              >
                Pagar por transferencia
              </button>
            </div>
          )}
          <button
            type="button"
            className={`${styles.secondaryBtn} ${styles.wide}`}
            onClick={onWhatsApp}
            disabled={pending}
            data-testid="checkout-whatsapp"
            style={{ marginTop: 10 }}
          >
            <MessageCircle size={18} />
            Coordinar por WhatsApp
          </button>
          <button type="button" className={`${styles.comboLink}`} onClick={onClose} data-testid="checkout-back-catalog">
            Seguir mirando el catálogo
          </button>
        </div>
      </div>
  )
}
