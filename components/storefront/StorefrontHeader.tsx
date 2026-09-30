'use client'

import type { Ref } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import styles from './storefront.module.css'

type Props = {
  bagCount?: number
  onBag?: () => void
  search?: string
  onSearch?: (value: string) => void
  searchRef?: Ref<HTMLInputElement>
  simple?: boolean
}

export function StorefrontHeader({
  bagCount = 0,
  onBag,
  search,
  onSearch,
  searchRef,
  simple = false,
}: Props) {
  return (
    <header className={styles.header}>
      <div className={`${styles.wrap} ${styles.head}`}>
        <Link className={styles.brand} href="/catalogo" aria-label="Ilara, ir al catálogo">
          <Image
            src="/logo-header.png"
            alt="Ilara"
            width={168}
            height={44}
            priority
            style={{ width: 'auto', height: 'auto', maxHeight: 44 }}
          />
        </Link>
        {!simple && onSearch ? (
          <label className={styles.search}>
            <span className="sr-only">Buscar productos</span>
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Buscá un producto o una marca"
              aria-label="Buscar productos por nombre o marca"
              autoComplete="off"
            />
          </label>
        ) : null}
        {onBag ? (
          <button
            className={styles.bag}
            type="button"
            onClick={onBag}
            aria-label={bagCount > 0 ? `Ver bolsa, ${bagCount} ítems` : 'Ver bolsa'}
          >
            Bolsa
            <span className={styles.bagCount} aria-hidden>{bagCount}</span>
          </button>
        ) : (
          <Link className={styles.bag} href="/catalogo">
            Catálogo
          </Link>
        )}
      </div>
    </header>
  )
}
