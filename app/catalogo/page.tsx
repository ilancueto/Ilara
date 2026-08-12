import type { Metadata } from 'next'
import Catalogo from '@/components/Catalogo'
import { createSupabasePublicClient } from '@/lib/supabase/public'
import {
    fetchCatalogProductsServer,
    fetchCatalogCombosServer,
    fetchCatalogCategoriesServer,
} from '@/lib/catalog/serverCatalog'
import { getSiteUrl } from '@/lib/site'

const catalogDescription =
    'Catálogo de productos de belleza en Neuquén: maquillaje, skincare y cosmética. Pedidos rápidos por WhatsApp.'

/** Mismo origen que app/layout.tsx para OG/Twitter (previews en Meta, WhatsApp, etc.). */
const canonicalShareOrigin =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '') ||
    'https://ilara.com.ar'

const shareOgImageUrl = new URL('/og-image.png', `${canonicalShareOrigin}/`).href
const catalogOgUrl = new URL('/catalogo', `${canonicalShareOrigin}/`).href
const catalogCanonicalUrl = `${getSiteUrl().replace(/\/$/, '')}/catalogo`

export const metadata: Metadata = {
    title: 'Catálogo de belleza en Neuquén',
    description: catalogDescription,
    alternates: {
        canonical: catalogCanonicalUrl,
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

/** ISR: datos del catálogo en HTML inicial + revalidación periódica. */
export const revalidate = 60

export default async function CatalogoPage() {
    // Cliente público sin cookies → permite ISR (revalidate) real en catálogo.
    const supabase = createSupabasePublicClient()
    const [pr, co, ca] = await Promise.all([
        fetchCatalogProductsServer(supabase),
        fetchCatalogCombosServer(supabase),
        fetchCatalogCategoriesServer(supabase),
    ])
    const serverFetchFailed = !pr.ok || !co.ok || !ca.ok

    return (
        <Catalogo
            initialCatalog={{
                productos: pr.ok ? pr.data : [],
                combos: co.ok ? co.data : [],
                categorias: ca.ok ? ca.data : [],
                serverFetchFailed,
            }}
        />
    )
}
