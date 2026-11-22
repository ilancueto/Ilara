'use client'

import { useState, type ReactNode } from 'react'
import styles from './storefront.module.css'

type Props = {
  hidden?: boolean
  /** Tarjetas de lo más nuevo. */
  fresh: ReactNode[]
  /** Tarjetas de lo que queda poco. */
  low: ReactNode[]
}

/** "Para mirar primero": novedades y últimas unidades, en una fila que se desliza. */
export function CatalogRail({ hidden = false, fresh, low }: Props) {
  const [tab, setTab] = useState<'fresh' | 'low'>('fresh')
  if (hidden || (fresh.length === 0 && low.length === 0)) return null
  const showTabs = fresh.length > 0 && low.length > 0
  const active = tab === 'low' && low.length > 0 ? 'low' : fresh.length > 0 ? 'fresh' : 'low'
  const items = active === 'fresh' ? fresh : low

  return (
    <section className={styles.rail} aria-labelledby="catalogo-mirar-primero">
      <div className={styles.railHead}>
        <h2 id="catalogo-mirar-primero">Para mirar primero</h2>
        {showTabs ? (
          <div className={styles.tabs} role="group" aria-label="Novedades y últimas unidades">
            <button
              type="button"
              className={`${styles.tab} ${active === 'fresh' ? styles.tabActive : ''}`}
              aria-pressed={active === 'fresh'}
              onClick={() => setTab('fresh')}
            >
              Recién llegado
            </button>
            <button
              type="button"
              className={`${styles.tab} ${active === 'low' ? styles.tabActive : ''}`}
              aria-pressed={active === 'low'}
              onClick={() => setTab('low')}
            >
              Quedan pocas
            </button>
          </div>
        ) : null}
      </div>
      <div className={styles.railTrack}>{items}</div>
    </section>
  )
}
