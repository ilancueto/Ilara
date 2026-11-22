import Image from 'next/image'
import Link from 'next/link'
import { Heart, Plus } from 'lucide-react'
import { CatalogPrice } from '@/components/Catalogo/CatalogPrice'
import styles from './storefront.module.css'

type Props = {
  name: string
  href?: string
  brand?: string | null
  image?: string | null
  badge?: string | null
  amount: number
  listAmount?: number | null
  dual?: boolean
  publicAmount?: number | null
  transferAmount?: number | null
  available: boolean
  /** Unidades que quedan cuando son pocas (se muestra "Quedan N"). */
  lowStock?: number | null
  cartReady: boolean
  onAdd: () => void
  onOpen?: () => void
  comboIncludes?: () => void
  priority?: boolean
  /** Tarjeta grande (2×2) al inicio de la grilla. */
  featured?: boolean
  /** Si se pasa, muestra el corazón para guardar en "Mi lista". */
  favorite?: boolean
  onToggleFavorite?: () => void
}

export function ProductCard({
  name,
  href,
  brand,
  image,
  badge,
  amount,
  listAmount,
  dual,
  publicAmount,
  transferAmount,
  available,
  lowStock = null,
  cartReady,
  onAdd,
  onOpen,
  comboIncludes,
  priority = false,
  featured = false,
  favorite = false,
  onToggleFavorite,
}: Props) {
  const sizes = featured
    ? '(max-width: 767px) 100vw, (max-width: 1099px) 66vw, 50vw'
    : '(max-width: 767px) 50vw, (max-width: 1099px) 33vw, 25vw'
  const openLabel = `Ver ${name}`

  const media = image ? (
    <Image
      src={image}
      alt={name}
      fill
      sizes={sizes}
      priority={priority}
      loading={priority ? 'eager' : undefined}
    />
  ) : (
    <span className={styles.photoFallback} role="img" aria-label={`${name}, sin imagen`}>
      Sin imagen
    </span>
  )

  // Una sola etiqueta sobre la foto: agotado > pocas unidades > insignia del producto.
  const tag = !available
    ? <span className={`${styles.badge} ${styles.badgeOut}`}>Agotado</span>
    : lowStock != null
      ? <span className={`${styles.badge} ${styles.badgeLow}`}>Quedan {lowStock}</span>
      : badge
        ? <span className={styles.badge}>{badge}</span>
        : null

  return (
    <article className={featured ? `${styles.card} ${styles.cardFeatured}` : styles.card}>
      <div className={styles.photoWrap}>
        {href ? (
          <Link className={styles.photo} href={href} aria-label={openLabel}>
            {media}
            {tag}
          </Link>
        ) : (
          <button className={styles.photo} type="button" onClick={onOpen} aria-label={openLabel}>
            {media}
            {tag}
          </button>
        )}
        {onToggleFavorite ? (
          <button
            type="button"
            className={`${styles.heart} ${favorite ? styles.heartOn : ''}`}
            onClick={onToggleFavorite}
            aria-pressed={favorite}
            aria-label={favorite ? `Quitar ${name} de mi lista` : `Guardar ${name} en mi lista`}
          >
            <Heart size={20} aria-hidden fill={favorite ? 'currentColor' : 'none'} />
          </button>
        ) : null}
        {available ? (
          <button
            className={styles.quick}
            type="button"
            disabled={!cartReady}
            aria-busy={!cartReady ? true : undefined}
            aria-label="Agregar a la bolsa"
            title="Agregar a la bolsa"
            onClick={onAdd}
          >
            <Plus size={22} aria-hidden />
          </button>
        ) : null}
      </div>
      <div className={styles.brandLabel}>{brand?.trim() || ' '}</div>
      {href ? (
        <Link className={styles.name} href={href}>{name}</Link>
      ) : (
        <button type="button" className={styles.name} onClick={onOpen}>{name}</button>
      )}
      <div className={styles.cardFooter}>
        <CatalogPrice
          className={styles.price}
          amount={amount}
          listAmount={listAmount}
          dual={dual}
          publicAmount={publicAmount}
          transferAmount={transferAmount}
          compact
        />
        {comboIncludes ? (
          <button type="button" className={styles.comboLink} onClick={comboIncludes}>
            Ver qué incluye
          </button>
        ) : null}
      </div>
    </article>
  )
}
