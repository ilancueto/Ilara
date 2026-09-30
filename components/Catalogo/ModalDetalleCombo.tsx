'use client'

import { useRef } from 'react'
import { getProductImages } from '@/lib/supabase'
import type { PublicCatalogCombo, PublicCatalogProduct } from '@/lib/domain/catalog/publicDto'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import Image from 'next/image'
import { X } from 'lucide-react'
import { CatalogPrice } from '@/components/Catalogo/CatalogPrice'
import styles from '@/components/storefront/storefront.module.css'

interface ModalDetalleComboProps {
  combo: PublicCatalogCombo
  onClose: () => void
  onAgregar: () => void
  disponible: boolean
}

export function ModalDetalleCombo({ combo, onClose, onAgregar, disponible }: ModalDetalleComboProps) {
  const items = combo.combo_items || []
  const panelRef = useRef<HTMLDivElement>(null)
  useDialogA11y(true, onClose, panelRef)

  return (
    <div className={`storefront ${styles.dialog}`}>
      <button className={styles.backdrop} type="button" onClick={onClose} aria-label="Cerrar detalle del combo" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="combo-detail-title"
        className={styles.dialogPanel}
      >
        <button className={styles.iconBtn} onClick={onClose} aria-label="Cerrar" style={{ position: 'absolute', top: 12, right: 12 }}>
          <X size={18} />
        </button>
        <p className={styles.eyebrow}>Combo</p>
        <h2 id="combo-detail-title">{combo.name}</h2>
        {combo.description ? <p className={styles.muted}>{combo.description}</p> : null}
        <CatalogPrice
          className={styles.price}
          amount={combo.sale_price}
          dual={combo.dual_price_visible === true}
          publicAmount={combo.public_price}
          transferAmount={combo.transfer_price}
        />
        <h3 style={{ fontSize: 16, margin: '20px 0 12px' }}>Qué incluye</h3>
        <div>
          {items.map((ci, idx) => {
            const prod = ci.products as PublicCatalogProduct | undefined
            const nombre = prod?.name ?? 'Producto incluido'
            const img = prod ? getProductImages(prod)[0] : undefined
            return (
              <div key={ci.id ?? idx} className={styles.itemRow} style={{ alignItems: 'center' }}>
                <div className={styles.mini}>
                  {img ? (
                    <Image src={img} alt="" width={70} height={78} />
                  ) : (
                    <span className={styles.photoFallback}>Sin imagen</span>
                  )}
                </div>
                <div className={styles.itemCopy}>
                  <p>{nombre}</p>
                  <p className={styles.muted}>Cantidad: {ci.quantity}</p>
                </div>
              </div>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => { if (disponible) { onAgregar(); onClose() } }}
          disabled={!disponible}
          className={`${styles.primaryBtn} ${styles.wide}`}
          style={{ marginTop: 16 }}
        >
          {disponible ? 'Agregar a la bolsa' : 'Sin stock'}
        </button>
      </div>
    </div>
  )
}
