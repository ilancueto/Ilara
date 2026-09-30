import type { PublicCatalogCategory } from '@/lib/domain/catalog/publicDto'
import { COMBOS_FILTER } from '@/lib/domain/catalog/catalogView'
import styles from './storefront.module.css'

type Props = {
  categorias: PublicCatalogCategory[]
  value: string
  onChange: (value: string) => void
  showCombos?: boolean
}

export function CategoryNav({ categorias, value, onChange, showCombos = false }: Props) {
  return (
    <nav className={`${styles.wrap} ${styles.subnav}`} aria-label="Categorías">
      <button
        type="button"
        className={`${styles.subnavBtn} ${value === 'all' ? styles.subnavBtnActive : ''}`}
        onClick={() => onChange('all')}
        aria-pressed={value === 'all'}
      >
        Todo
      </button>
      {categorias.map((categoria) => {
        const id = String(categoria.id)
        return (
          <button
            key={categoria.id}
            type="button"
            className={`${styles.subnavBtn} ${value === id ? styles.subnavBtnActive : ''}`}
            onClick={() => onChange(id)}
            aria-pressed={value === id}
          >
            {categoria.name}
          </button>
        )
      })}
      {showCombos ? (
        <button
          type="button"
          className={`${styles.subnavBtn} ${value === COMBOS_FILTER ? styles.subnavBtnActive : ''}`}
          onClick={() => onChange(COMBOS_FILTER)}
          aria-pressed={value === COMBOS_FILTER}
        >
          Combos
        </button>
      ) : null}
    </nav>
  )
}
