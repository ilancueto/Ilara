import Image from 'next/image'
import Link from 'next/link'
import type { CatalogHeroTile } from '@/lib/domain/catalog/catalogHero'
import styles from './storefront.module.css'

type Props = {
  hidden?: boolean
  photo: { src: string; alt: string } | null
  tiles: CatalogHeroTile[]
  onSelectCategory: (id: string) => void
}

/** Fondo pastel de cada acceso rápido (mismos tonos que las tarjetas). */
const TILE_TINTS = ['var(--sf-tint-3)', 'var(--sf-tint-2)']

/** Portada del catálogo en bloques: mensaje, foto y accesos a las categorías principales. */
export function CatalogHero({ hidden = false, photo, tiles, onSelectCategory }: Props) {
  return (
    <section
      className={`${styles.intro} ${hidden ? styles.introHidden : ''}`}
      aria-labelledby="catalogo-titulo-principal"
    >
      <div className={styles.introLead}>
        <p className={styles.eyebrow}>Ilara Beauty · Neuquén</p>
        <h1 id="catalogo-titulo-principal">Un poco de color. Mucho de vos.</h1>
        <Link href="/sobre-ilara" className={styles.aboutLink}>Quiénes somos</Link>
      </div>

      {photo ? (
        <div className={styles.introPhoto}>
          <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 900px) 30vw, 1px" />
        </div>
      ) : null}

      {tiles.map((tile, index) => (
        <button
          key={tile.id}
          type="button"
          className={styles.introTile}
          style={{ background: TILE_TINTS[index % TILE_TINTS.length] }}
          onClick={() => onSelectCategory(tile.id)}
        >
          <strong>{tile.name}</strong>
          <small>
            {tile.count} {tile.count === 1 ? 'producto' : 'productos'} <span aria-hidden>→</span>
          </small>
          {tile.image ? (
            <span className={styles.introTileImg} aria-hidden>
              <Image src={tile.image} alt="" fill sizes="120px" />
            </span>
          ) : null}
        </button>
      ))}
    </section>
  )
}
