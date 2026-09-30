import type { Metadata } from 'next'
import Link from 'next/link'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import styles from '@/components/storefront/storefront.module.css'

export const metadata: Metadata = {
  title: 'Producto no encontrado',
  robots: { index: false, follow: false },
}

export default function CatalogProductNotFound() {
  return (
    <StorefrontShell header={<StorefrontHeader simple />}>
      <main className={`${styles.wrap} ${styles.empty}`}>
        <h1>Producto no encontrado</h1>
        <p>Ese producto no está en el catálogo público. Podés seguir mirando el resto.</p>
        <Link href="/catalogo" className={styles.primaryBtn}>Volver al catálogo</Link>
      </main>
    </StorefrontShell>
  )
}
