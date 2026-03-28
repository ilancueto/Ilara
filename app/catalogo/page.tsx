import type { Metadata } from 'next'
import Catalogo from '@/components/Catalogo'
import { getSiteUrl } from '@/lib/site'

const catalogDescription =
    'Catálogo de productos de belleza y cosmética. Novedades, ofertas y pedido por WhatsApp.'
const siteOrigin = getSiteUrl().replace(/\/$/, '')
const ogImageUrl = `${siteOrigin}/icon-512.png`

export const metadata: Metadata = {
    title: 'Catálogo',
    description: catalogDescription,
    alternates: {
        canonical: '/catalogo',
    },
    robots: {
        index: true,
        follow: true,
    },
    openGraph: {
        title: 'Catálogo | Ilara',
        description: catalogDescription,
        url: `${siteOrigin}/catalogo`,
        images: [{ url: ogImageUrl, width: 512, height: 512, alt: 'Ilara' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Catálogo | Ilara',
        description: catalogDescription,
        images: [ogImageUrl],
    },
}

export default function CatalogoPage() {
    return <Catalogo />
}
