import Image from 'next/image'
import Link from 'next/link'
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
  cartReady: boolean
  onAdd: () => void
  onOpen?: () => void
  comboIncludes?: () => void
  priority?: boolean
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
  cartReady,
  onAdd,
  onOpen,
  comboIncludes,
  priority = false,
}: Props) {
  const sizes = '(max-width: 767px) 50vw, (max-width: 1099px) 33vw, 25vw'
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

  return (
    <article className={styles.card}>
      {href ? (
        <Link className={styles.photo} href={href} aria-label={openLabel}>
          {media}
          {badge ? <span className={styles.badge}>{badge}</span> : null}
        </Link>
      ) : (
        <button className={styles.photo} type="button" onClick={onOpen} aria-label={openLabel}>
          {media}
          {badge ? <span className={styles.badge}>{badge}</span> : null}
        </button>
      )}
      {brand ? <div className={styles.brandLabel}>{brand}</div> : null}
      {href ? (
        <Link className={styles.name} href={href}>{name}</Link>
      ) : (
        <button type="button" className={styles.name} onClick={onOpen}>{name}</button>
      )}
      <CatalogPrice
        className={styles.price}
        amount={amount}
        listAmount={listAmount}
        dual={dual}
        publicAmount={publicAmount}
        transferAmount={transferAmount}
      />
      <button
        className={styles.addBtn}
        type="button"
        disabled={!available || !cartReady}
        onClick={onAdd}
      >
        {!cartReady ? 'Verificando…' : available ? 'Agregar a la bolsa' : 'Sin stock'}
      </button>
      {comboIncludes ? (
        <button type="button" className={styles.comboLink} onClick={comboIncludes}>
          Ver qué incluye
        </button>
      ) : null}
    </article>
  )
}
