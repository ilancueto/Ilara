import Link from 'next/link'
import styles from './storefront.module.css'
import { ILARA_INSTAGRAM_URL } from '@/lib/storefrontIdentity'

export function StorefrontFooter() {
  return (
    <footer className={`${styles.wrap} ${styles.footer}`}>
      <div>
        <strong>Ilara Beauty</strong>
        <p className={styles.muted} style={{ margin: '6px 0 0' }}>Belleza a tu manera. Neuquén, Argentina.</p>
      </div>
      <div className={styles.footerLinks}>
        <Link href="/sobre-ilara">Sobre Ilara</Link>
        <Link href="/sobre-ilara#contacto">Contacto</Link>
        <a href={ILARA_INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">Instagram <span aria-hidden="true">↗</span></a>
        <Link href="/pedido">Seguir mi pedido</Link>
        <Link href="/catalogo">Volver al catálogo</Link>
        <Link href="/login">Ingresar</Link>
      </div>
    </footer>
  )
}
