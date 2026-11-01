import type { Metadata } from 'next'
import Link from 'next/link'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import styles from './page.module.css'
import { ILARA_INSTAGRAM_URL } from '@/lib/storefrontIdentity'
import { serializeJsonLd } from '@/lib/security/serializeJsonLd'

const origin = 'https://ilara.com.ar'
const description = 'Somos Ilara, un emprendimiento de belleza de Neuquén. Conocé nuestra historia y descubrí nuestro catálogo de maquillaje, skincare y cosmética.'

export const metadata: Metadata = {
  title: { absolute: 'Sobre Ilara Beauty | Nuestra historia en Neuquén' },
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
    name: 'Sobre Ilara Beauty: nuestra historia en Neuquén',
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
            <p className={styles.eyebrow}>Hola, somos Ilara Beauty</p>
            <h1 id="about-title">Un poco de color.<br /><span>Mucho de vos.</span></h1>
            <p className={styles.lead}>Maquillaje, skincare y cosmética desde Neuquén. Un lugar para encontrar ese labial que te gusta, sumar algo a tu rutina o probar un color distinto.</p>
            <div className={styles.actions}>
              <Link className={styles.primary} href="/catalogo">Explorá el catálogo <span aria-hidden="true">↗</span></Link>
              <a className={styles.textLink} href="#historia">Nuestra historia <span aria-hidden="true">↓</span></a>
            </div>
          </div>
          <div className={styles.identity} aria-hidden="true">
            <span className={styles.brandName}>Ilara</span>
            <p className={styles.identityTitle}>Belleza a tu manera.</p>
            <p className={styles.identityPlace}>Neuquén, Argentina</p>
          </div>
        </section>

        <section id="historia" className={styles.story} aria-labelledby="story-title">
          <p className={styles.eyebrow}>Nuestra historia</p>
          <div>
            <h2 id="story-title">Detrás de Ilara estamos Mara e Ilan.</h2>
            <p>Somos una pareja de Neuquén. En enero de 2026 empezó Ilara, el emprendimiento de Mara que hoy compartimos, cada uno desde su lugar.</p>
            <p>Mara es la fundadora y quien está al frente de Ilara. Ilan acompaña como cofundador, haciendo la web y las herramientas que ayudan a llevar el negocio. Pero esta página tiene algo más detrás: fue una manera de acompañar a Mara y de poner en palabras, y en algo hecho para ella, ese amor.</p>
            <figure className={styles.loveNote}>
              <blockquote>
                <p>Esta web es mi forma de acompañarte, Mara. De apoyar lo que estás construyendo y de decirte que creo en vos. Quería que tuvieras algo hecho con amor, y que supieras que, mientras estemos juntos, no vas a estar sola en esto.</p>
              </blockquote>
              <figcaption>Ilan, para Mara.</figcaption>
            </figure>
          </div>
        </section>

        <section className={styles.shopping} aria-labelledby="shopping-title">
          <p className={styles.eyebrow}>Elegí algo para vos</p>
          <h2 id="shopping-title">Maquillaje y skincare en Neuquén, a tu manera.</h2>
          <p>En el catálogo podés recorrer labiales, bases, sombras, brochas y productos de skincare. Cada ficha muestra el precio y la disponibilidad, para que puedas elegir con calma.</p>
          <div className={styles.questions}>
            <details><summary>¿Cómo hago un pedido?</summary><p>Entrá al <Link href="/catalogo">catálogo de Ilara</Link>, elegí tus productos y sumalos a la bolsa. Desde ahí podés completar el pedido online o compartirlo por WhatsApp.</p></details>
            <details><summary>¿Puedo consultar antes de comprar?</summary><p>Sí. En cada ficha de producto tenés un botón para consultar por WhatsApp. También podés escribirnos por correo o encontrarnos en <a href={ILARA_INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">Instagram, @ilara__beauty</a>.</p></details>
            <details><summary>¿Cómo coordino la entrega o el retiro?</summary><p>Al completar tu pedido podés elegir retiro o consultar el costo de envío. Si tenés dudas, escribinos antes de confirmar.</p></details>
          </div>
        </section>

        <section id="contacto" className={styles.contact} aria-labelledby="contact-title">
          <div>
            <p className={styles.eyebrow}>Hablemos</p>
            <h2 id="contact-title">¿Nos querés escribir?</h2>
            <p>Del otro lado estamos nosotros. Si tenés una consulta, una idea o simplemente querés saludarnos, podés escribirnos.</p>
          </div>
          <div className={styles.contacts}>
            <div><span className={styles.contactName}>Mara</span><a className={styles.email} href="mailto:mara.baidal@ilara.com.ar">mara.baidal@ilara.com.ar <span aria-hidden="true">↗</span></a></div>
            <div><span className={styles.contactName}>Ilan</span><a className={styles.email} href="mailto:ilan.cueto@ilara.com.ar">ilan.cueto@ilara.com.ar <span aria-hidden="true">↗</span></a></div>
          </div>
        </section>

      </main>
    </StorefrontShell>
  )
}
