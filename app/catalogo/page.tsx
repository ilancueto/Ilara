import type { Metadata } from 'next'
import Catalogo from '@/components/Catalogo'
import { getSiteUrl } from '@/lib/site'

const catalogDescription =
    'Catálogo de productos de belleza en Neuquén: maquillaje, skincare y cosmética. Pedidos rápidos por WhatsApp.'
const siteOrigin = getSiteUrl().replace(/\/$/, '')
const ogImageUrl = `${siteOrigin}/icon-512.png`

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
        url: `${siteOrigin}/catalogo`,
        images: [{ url: ogImageUrl, width: 512, height: 512, alt: 'Ilara' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Catálogo de belleza en Neuquén | Ilara',
        description: catalogDescription,
        images: [ogImageUrl],
    },
}

export default function CatalogoPage() {
    return <Catalogo />
}
