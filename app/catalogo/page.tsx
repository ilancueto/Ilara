import type { Metadata } from 'next'
import Catalogo from '@/components/Catalogo'

const catalogDescription =
    'Catálogo de productos de belleza en Neuquén: maquillaje, skincare y cosmética. Pedidos rápidos por WhatsApp.'

/** Mismo origen que app/layout.tsx para OG/Twitter (previews en Meta, WhatsApp, etc.). */
const canonicalShareOrigin =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '') ||
    'https://ilara.com.ar'

const shareOgImageUrl = new URL('/og-image.png', `${canonicalShareOrigin}/`).href
const catalogOgUrl = new URL('/catalogo', `${canonicalShareOrigin}/`).href

export const metadata: Metadata = {
    title: 'Catálogo de belleza en Neuquén',
    description: catalogDescription,
    alternates: {
        canonical: '/catalogo',
    },
    robots: {
        index: true,
        follow: true,
    },
    openGraph: {
        title: 'Catálogo de belleza en Neuquén | Ilara',
        description: catalogDescription,
        url: catalogOgUrl,
        images: [
            {
                url: shareOgImageUrl,
                width: 1200,
                height: 630,
                alt: 'Ilara Beauty',
                type: 'image/png',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Catálogo de belleza en Neuquén | Ilara',
        description: catalogDescription,
        images: [shareOgImageUrl],
    },
}

export default function CatalogoPage() {
    return <Catalogo />
}
