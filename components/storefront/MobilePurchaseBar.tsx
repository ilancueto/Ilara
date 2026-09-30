'use client'

import styles from './storefront.module.css'

type Props = {
  visible: boolean
  disabled: boolean
  label: string
  onAdd: () => void
}

export function MobilePurchaseBar({ visible, disabled, label, onAdd }: Props) {
  if (!visible) return null
  return (
    <div className={styles.mobileBar}>
      <button
        type="button"
        className={`${styles.primaryBtn} ${styles.wide}`}
        disabled={disabled}
        onClick={onAdd}
      >
        {label}
      </button>
    </div>
  )
}
