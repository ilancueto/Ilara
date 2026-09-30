import Link from 'next/link'
import styles from './storefront.module.css'

export function StorefrontFooter() {
  return (
    <footer className={`${styles.wrap} ${styles.footer}`}>
      <div>
        <strong>Ilara</strong>
        <p className={styles.muted} style={{ margin: '6px 0 0' }}>Belleza a tu manera. Neuquén, Argentina.</p>
      </div>
      <div className={styles.footerLinks}>
        <Link href="/pedido">Seguir mi pedido</Link>
        <Link href="/catalogo">Volver al catálogo</Link>
        <Link href="/login">Ingresar</Link>
      </div>
    </footer>
  )
}
