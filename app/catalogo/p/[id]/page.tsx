import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createSupabasePublicClient } from '@/lib/supabase/public'
import {
    fetchCatalogProductByIdServer,
    fetchCatalogRelatedProductsServer,
} from '@/lib/catalog/serverCatalog'
import { ProductPublicDetailClient } from '@/components/product/ProductPublicDetailClient'
import { ProductoCatalogoRecover } from '@/components/Catalogo/ProductoCatalogoRecover'
import { getSiteUrl } from '@/lib/site'
import { getProductImages, type Producto } from '@/lib/supabase'
import { priceWithProductDiscount } from '@/lib/catalogPricing'
import { buildProductJsonLd } from '@/lib/productStructuredData'
import { formatPesoAR } from '@/lib/formatPesoAR'
import { serializeJsonLd } from '@/lib/security/serializeJsonLd'

export const revalidate = 120

type PageProps = { params: Promise<{ id: string }> }

/**
 * Prerenderiza las fichas hoy visibles y permite que Next las revalide.
 * Las altas posteriores conservan `dynamicParams` por defecto y se generan en
 * su primera visita; la consulta usa sólo la superficie anónima del catálogo.
 */
export async function generateStaticParams(): Promise<Array<{ id: string }>> {
    const supabase = createSupabasePublicClient()
    const { data, error } = await supabase
        .from('products')
        .select('id')
        .gte('stock', 0)
        .or('visible_in_catalog.eq.true,visible_in_catalog.is.null')

    if (error) {
        console.error('[catalog server] product ids for prerender', error.message)
        return []
    }

    return (data ?? []).map(({ id }) => ({ id: String(id) }))
}

function absoluteFromSite(pathOrUrl: string, siteOrigin: string): string {
    const t = pathOrUrl.trim()
    if (!t) return ''
    if (/^https?:\/\//i.test(t)) return t
    return new URL(t.replace(/^\//, ''), `${siteOrigin.replace(/\/$/, '')}/`).href
}

function buildProductDescription(p: Producto, precioFinal: number): string {
    const parts: string[] = []
    const brand = p.brand?.trim()
    if (brand) parts.push(`${p.name} · ${brand}`)
    else parts.push(p.name)
    parts.push(`$${formatPesoAR(precioFinal)}`)
    if (p.categories?.name) parts.push(p.categories.name)
    // Sin notes internas en meta pública (Etapa 0 / SEC-02).
    parts.push('Belleza y cosmética en Neuquén. Pedidos por WhatsApp en Ilara Beauty.')
    const joined = parts.join('. ')
    return joined.length > 165 ? `${joined.slice(0, 162)}…` : joined
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id: raw } = await params
    const id = parseInt(raw, 10)
    if (!Number.isFinite(id)) return { title: 'Producto' }

    const supabase = createSupabasePublicClient()
    const res = await fetchCatalogProductByIdServer(supabase, id)
    if (res.status === 'error') return { title: 'Producto' }
    if (res.status === 'not_found') return { title: 'Producto no encontrado' }
    const p = res.product

    const siteOrigin = getSiteUrl().replace(/\/$/, '')
    const canonical = `${siteOrigin}/catalogo/p/${id}`
    const precioFinal = priceWithProductDiscount(p.sale_price, p.discount_percentage)
    const desc = buildProductDescription(p, precioFinal)
    const titleBase = p.brand?.trim() ? `${p.name} · ${p.brand.trim()}` : p.name

    /** Misma base que canonical para evitar OG/canonical en dominios distintos (p. ej. preview vs producción). */
    const fallbackOg = new URL('/og-image.png', `${siteOrigin}/`).href
    const imgs = getProductImages(p)
    const primaryImg = imgs[0] ? absoluteFromSite(imgs[0], siteOrigin) : ''
    const ogImages = primaryImg
        ? [{ url: primaryImg, alt: p.name }]
        : [
              {
                  url: fallbackOg,
                  width: 1200,
                  height: 630,
                  alt: 'Ilara Beauty',
                  type: 'image/png' as const,
              },
          ]

    return {
        title: titleBase,
        description: desc,
        alternates: { canonical },
        robots: { index: true, follow: true },
        openGraph: {
            title: `${titleBase} | Ilara Beauty`,
            description: desc,
            url: canonical,
            type: 'website',
            locale: 'es_AR',
            siteName: 'Ilara Beauty',
            images: ogImages,
        },
        twitter: {
            card: 'summary_large_image',
            title: `${titleBase} | Ilara Beauty`,
            description: desc,
            images: primaryImg ? [primaryImg] : [fallbackOg],
        },
    }
}

export default async function CatalogoProductoPage({ params }: PageProps) {
    const { id: raw } = await params
    const id = parseInt(raw, 10)
    if (!Number.isFinite(id)) notFound()

    const supabase = createSupabasePublicClient()
    const res = await fetchCatalogProductByIdServer(supabase, id)
    if (res.status === 'error') {
        return <ProductoCatalogoRecover id={id} canonicalPath={`/catalogo/p/${id}`} />
    }
    if (res.status === 'not_found') notFound()

    const p = res.product
    const related = await fetchCatalogRelatedProductsServer(
        supabase,
        p.id,
        p.category_id,
        8
    )

    const siteOrigin = getSiteUrl().replace(/\/$/, '')
    const canonical = `${siteOrigin}/catalogo/p/${id}`
    const precioFinal = priceWithProductDiscount(p.sale_price, p.discount_percentage)
    const jsonLd = buildProductJsonLd(p, canonical, siteOrigin, precioFinal)

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
            />
            <ProductPublicDetailClient
                producto={p}
                canonicalPath={`/catalogo/p/${id}`}
                relatedProducts={related}
            />
        </>
    )
}
