import type { CSSProperties } from 'react'
import Link from 'next/link'
import { SWATCH_COLORS, type CatalogSwatch } from '@/lib/domain/catalog/catalogSwatches'
import styles from './storefront.module.css'

type Props = {
  hidden?: boolean
  swatches: CatalogSwatch[]
  onSelectCategory: (id: string) => void
}

/** Posición y largo de cada trazo (se repite si hay más categorías que entradas). */
const LAYOUT: Array<[string, string]> = [
  ['8%', '78%'], ['0%', '92%'], ['12%', '80%'], ['2%', '88%'], ['10%', '84%'],
  ['0%', '76%'], ['7%', '90%'], ['3%', '72%'], ['11%', '82%'],
]

/** Portada: titular y un trazo de producto por categoría, que filtra el catálogo al tocarlo. */
export function CatalogHero({ hidden = false, swatches, onSelectCategory }: Props) {
  // Con pocas categorías los trazos no se estiran: se reparten en un mínimo de 6 filas, centrados.
  const rows = Math.max(swatches.length, 6)
  return (
    <section
      className={`${styles.hero} ${hidden ? styles.heroHidden : ''}`}
      aria-labelledby="catalogo-titulo-principal"
    >
      <div>
        <h1 id="catalogo-titulo-principal" className={styles.heroTitle}>
          <span className={styles.heroLine}><span>Un poco de color.</span></span>
          <span className={styles.heroLine}><span>Mucho de vos.</span></span>
        </h1>
        <p className={styles.heroLead}>
          Maquillaje, skincare y cosmética de Ilara Beauty. Armá tu bolsa y pedí online o por WhatsApp.
        </p>
        <div className={styles.heroActions}>
          <a href="#productos" className={styles.primaryBtn}>Ver el catálogo</a>
          <Link href="/sobre-ilara" className={styles.aboutLink}>Quiénes somos</Link>
        </div>
      </div>

      {swatches.length > 0 ? (
        <div
          className={styles.smear}
          role="group"
          aria-label="Categorías: tocá un trazo para ver sus productos"
          style={{ '--n': rows, '--pad': (rows - swatches.length) / 2 } as CSSProperties}
        >
          <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden focusable="false">
            <filter id="ilara-rough" x="-8%" y="-25%" width="116%" height="150%">
              <feTurbulence type="fractalNoise" baseFrequency="0.014 0.055" numOctaves="3" seed="7" result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="11" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </svg>
          {swatches.map((swatch, index) => {
            const color = SWATCH_COLORS[index % SWATCH_COLORS.length]
            const [x, w] = LAYOUT[index % LAYOUT.length]
            return (
              <button
                key={swatch.id}
                type="button"
                className={styles.stroke}
                style={{
                  '--i': index,
                  '--c': color,
                  '--x': x,
                  '--w': w,
                } as CSSProperties}
                onClick={() => onSelectCategory(swatch.id)}
                aria-label={`Ver ${swatch.name} (${swatch.count} ${swatch.count === 1 ? 'producto' : 'productos'})`}
              >
                {swatch.name}
              </button>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
