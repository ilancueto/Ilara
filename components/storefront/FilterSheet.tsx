'use client'

import { useRef, useState } from 'react'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import styles from './storefront.module.css'

type Props = {
  open: boolean
  onClose: () => void
  precioMin: number
  precioMax: number
  onApply: (min: number, max: number) => void
  onClear: () => void
}

export function FilterSheet({ open, onClose, precioMin, precioMax, onApply, onClear }: Props) {
  const panelRef = useRef<HTMLElement>(null)
  const [min, setMin] = useState(precioMin)
  const [max, setMax] = useState(precioMax)
  useDialogA11y(open, onClose, panelRef)

  if (!open) return null

  return (
    <div className={styles.sheet}>
      <button className={styles.sheetBackdrop} type="button" onClick={onClose} aria-label="Cerrar filtros" />
      <section
        ref={panelRef}
        className={styles.sheetPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="filtros-titulo"
      >
        <div className={styles.sheetHead}>
          <h2 id="filtros-titulo">Filtrar productos</h2>
          <button className={styles.iconBtn} type="button" onClick={onClose} aria-label="Cerrar filtros">
            ✕
          </button>
        </div>
        <label className={styles.field}>
          Precio mínimo
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={min || ''}
            onChange={(event) => setMin(Number(event.target.value) || 0)}
          />
        </label>
        <label className={styles.field}>
          Precio máximo
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={precioMax >= 999999 && max >= 999999 ? '' : max || ''}
            placeholder="Sin límite"
            onChange={(event) => setMax(event.target.value === '' ? 999999 : Number(event.target.value) || 0)}
          />
        </label>
        <button
          className={`${styles.primaryBtn} ${styles.wide}`}
          type="button"
          onClick={() => {
            onApply(min, max)
            onClose()
          }}
        >
          Ver resultados
        </button>
        <button
          className={`${styles.secondaryBtn} ${styles.wide}`}
          type="button"
          style={{ marginTop: 10 }}
          onClick={() => {
            onClear()
            onClose()
          }}
        >
          Limpiar filtros
        </button>
      </section>
    </div>
  )
}
