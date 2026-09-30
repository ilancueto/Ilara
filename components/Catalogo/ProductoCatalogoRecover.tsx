'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import styles from '@/components/storefront/storefront.module.css'

export function ProductoCatalogoRecover({ onRetry }: { onRetry?: () => void } = {}) {
  const router = useRouter()
  const retry = onRetry ?? (() => router.refresh())

  return (
    <StorefrontShell header={<StorefrontHeader simple />}>
      <main className={`${styles.wrap} ${styles.empty}`}>
        <h1>No pudimos cargar este producto</h1>
        <p>Puede ser un problema de conexión. Probá de nuevo en unos segundos.</p>
        <button type="button" className={styles.primaryBtn} onClick={retry}>
          Reintentar
        </button>
        <p>
          <Link href="/catalogo" className={styles.comboLink}>Ir al catálogo</Link>
        </p>
      </main>
    </StorefrontShell>
  )
}
