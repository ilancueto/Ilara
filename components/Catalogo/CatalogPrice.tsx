import { formatPesoAR } from '@/lib/formatPesoAR'
import { bankTransferSecondaryLine } from '@/lib/domain/payments/labels'
import styles from './CatalogPrice.module.css'

type Props = {
  amount: number
  listAmount?: number | null
  publicAmount?: number | null
  transferAmount?: number | null
  dual?: boolean
  className?: string
}

export function CatalogPrice({
  amount,
  listAmount,
  publicAmount,
  transferAmount,
  dual = false,
  className,
}: Props) {
  if (!dual || publicAmount == null || transferAmount == null) {
    const shown = publicAmount ?? amount
    return (
      <p className={className}>
        {listAmount != null && listAmount > shown && <s>${formatPesoAR(listAmount)}</s>}
        ${formatPesoAR(shown)}
      </p>
    )
  }

  return (
    <p className={`${styles.wrap} ${className ?? ''}`}>
      <span className={styles.public}>${formatPesoAR(publicAmount)}</span>
      <span className={styles.transfer}>{bankTransferSecondaryLine(formatPesoAR(transferAmount))}</span>
    </p>
  )
}
