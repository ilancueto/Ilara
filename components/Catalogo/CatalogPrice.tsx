import { formatPesoAR } from '@/lib/formatPesoAR'
import { bankTransferCompactLine, bankTransferSecondaryLine } from '@/lib/domain/payments/labels'
import styles from './CatalogPrice.module.css'

type Props = {
  amount: number
  listAmount?: number | null
  publicAmount?: number | null
  transferAmount?: number | null
  dual?: boolean
  /** Grilla: línea de transferencia corta. Ficha: texto completo. */
  compact?: boolean
  className?: string
}

export function CatalogPrice({
  amount,
  listAmount,
  publicAmount,
  transferAmount,
  dual = false,
  compact = false,
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

  const transferLine = compact
    ? bankTransferCompactLine(formatPesoAR(transferAmount))
    : bankTransferSecondaryLine(formatPesoAR(transferAmount))

  return (
    <p className={`${styles.wrap} ${className ?? ''}`}>
      <span className={styles.public}>${formatPesoAR(publicAmount)}</span>
      <span className={styles.transfer}>{transferLine}</span>
    </p>
  )
}
