import { formatPesoAR } from '@/lib/formatPesoAR'
import styles from './storefront.module.css'

type Line = { name: string; quantity: number; unitPrice: number; image?: string | null }

type Props = {
  items: Line[]
  productsTotal: number
  couponCode?: string | null
  couponDiscount?: number
  shippingLabel: string
  shippingAmount?: number | null
  showFinalTotal?: boolean
  hideItems?: boolean
  note?: string
}

export function OrderSummary({
  items,
  productsTotal,
  couponCode,
  couponDiscount = 0,
  shippingLabel,
  shippingAmount,
  showFinalTotal = false,
  hideItems = false,
  note = 'El total final se muestra después de elegir entrega y forma de pago.',
}: Props) {
  const afterCoupon = Math.max(0, productsTotal - couponDiscount)
  const total = afterCoupon + (shippingAmount ?? 0)

  return (
    <div>
      {hideItems ? null : <h2>Tu pedido</h2>}
      {hideItems ? null : items.map((item, index) => (
        <div key={`${item.name}-${index}`} className={styles.summaryRow}>
          <span>
            {item.name}
            <span className={styles.muted} style={{ display: 'block' }}>Cantidad: {item.quantity}</span>
          </span>
          <strong>${formatPesoAR(item.unitPrice * item.quantity)}</strong>
        </div>
      ))}
      <div className={styles.line}>
        <div className={styles.summaryRow}>
          <span>Productos</span>
          <span>${formatPesoAR(productsTotal)}</span>
        </div>
        {couponCode && couponDiscount > 0 ? (
          <div className={`${styles.summaryRow} ${styles.successText}`}>
            <span>Cupón {couponCode}</span>
            <span>−${formatPesoAR(couponDiscount)}</span>
          </div>
        ) : null}
        <div className={`${styles.summaryRow} ${styles.muted}`}>
          <span>Entrega</span>
          <span>{shippingAmount != null ? `$${formatPesoAR(shippingAmount)}` : shippingLabel}</span>
        </div>
        <div className={styles.summaryRow}>
          <strong>{showFinalTotal ? 'Total' : 'Subtotal'}</strong>
          <strong>${formatPesoAR(showFinalTotal ? total : afterCoupon)}</strong>
        </div>
        {!showFinalTotal ? <p className={styles.muted}>{note}</p> : null}
      </div>
    </div>
  )
}
