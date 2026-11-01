import type { Metadata } from 'next'
import Link from 'next/link'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import styles from './page.module.css'
import { ILARA_INSTAGRAM_URL } from '@/lib/storefrontIdentity'
import { serializeJsonLd } from '@/lib/security/serializeJsonLd'

const origin = 'https://ilara.com.ar'
const description =
  'Quiénes somos: Mara e Ilan detrás de Ilara Beauty. Historia, contacto y cómo hacer un pedido.'

export const metadata: Metadata = {
  title: { absolute: 'Sobre Ilara Beauty' },
  description,
  alternates: { canonical: `${origin}/sobre-ilara` },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Sobre Ilara Beauty',
    description,
    url: `${origin}/sobre-ilara`,
    siteName: 'Ilara Beauty',
    locale: 'es_AR',
    type: 'website',
    images: [{ url: `${origin}/og-image.png`, width: 1200, height: 630, alt: 'Ilara Beauty' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sobre Ilara Beauty',
    description,
    images: [`${origin}/og-image.png`],
  },
}

export default function AboutIlaraPage() {
  const aboutPage = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': `${origin}/sobre-ilara#page`,
    name: 'Sobre Ilara Beauty',
    url: `${origin}/sobre-ilara`,
    description,
    inLanguage: 'es-AR',
    about: { '@id': `${origin}/#organization` },
  }

  return (
    <StorefrontShell header={<StorefrontHeader simple />}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(aboutPage) }} />
      <main id="contenido" className={styles.main}>
        <section className={styles.hero} aria-labelledby="about-title">
          <div>
            <h1 id="about-title">Un poco de color.<br /><span>Mucho de vos.</span></h1>
            <div className={styles.actions}>
              <Link className={styles.primary} href="/catalogo">Ver catálogo</Link>
              <a className={styles.textLink} href="#historia">Nuestra historia</a>
            </div>
          </div>
        </section>

        <section id="historia" className={styles.story} aria-labelledby="story-title">
          <h2 id="story-title">Detrás de Ilara estamos Mara e Ilan.</h2>
          <div>
            <p>En enero de 2026 empezó Ilara, el emprendimiento de Mara. Hoy lo compartimos: ella al frente del negocio, Ilan con la web y las herramientas.</p>
            <p>Esta página también es una forma de acompañarla.</p>
            <figure className={styles.loveNote}>
              <blockquote>
                <p>Esta web es mi forma de acompañarte, Mara. De apoyar lo que estás construyendo y de decirte que creo en vos. Quería que tuvieras algo hecho con amor, y que supieras que, mientras estemos juntos, no vas a estar sola en esto.</p>
              </blockquote>
              <figcaption>Ilan, para Mara.</figcaption>
            </figure>
          </div>
        </section>

        <section className={styles.shopping} aria-labelledby="faq-title">
          <h2 id="faq-title">Pedidos</h2>
          <div className={styles.questions}>
            <details>
              <summary>¿Cómo hago un pedido?</summary>
              <p>Entrá al <Link href="/catalogo">catálogo</Link>, armá la bolsa y completá el pedido online o por WhatsApp.</p>
            </details>
            <details>
              <summary>¿Puedo consultar antes de comprar?</summary>
              <p>Sí: por WhatsApp en cada ficha, por correo o en <a href={ILARA_INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">Instagram</a>.</p>
            </details>
            <details>
              <summary>¿Cómo coordino entrega o retiro?</summary>
              <p>Al confirmar el pedido elegís retiro o consultás el envío. Si tenés dudas, escribinos antes.</p>
            </details>
          </div>
        </section>

        <section id="contacto" className={styles.contact} aria-labelledby="contact-title">
          <div>
            <h2 id="contact-title">Contacto</h2>
            <p>Consultas, ideas o un saludo.</p>
          </div>
          <div className={styles.contacts}>
            <div><span className={styles.contactName}>Mara</span><a className={styles.email} href="mailto:mara.baidal@ilara.com.ar">mara.baidal@ilara.com.ar</a></div>
            <div><span className={styles.contactName}>Ilan</span><a className={styles.email} href="mailto:ilan.cueto@ilara.com.ar">ilan.cueto@ilara.com.ar</a></div>
          </div>
        </section>
      </main>
    </StorefrontShell>
  )
}
