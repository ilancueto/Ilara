import { getProductImages } from '@/lib/domain/images'
import type { PublicCatalogProduct } from '@/lib/domain/catalog/publicDto'

const MERCHANT_NAME = 'Ilara Beauty'

function absoluteFromSite(pathOrUrl: string, siteOrigin: string): string {
    const t = pathOrUrl.trim()
    if (!t) return ''
    if (/^https?:\/\//i.test(t)) return t
    return new URL(t.replace(/^\//, ''), `${siteOrigin.replace(/\/$/, '')}/`).href
}

/**
 * Offer.price es el importe público principal (`catalogDisplayUnitPrice`):
 * lista con descuento de producto, no el de transferencia ni un cupón.
 * La transferencia es condicional y se muestra aparte en la ficha.
 */
export function buildProductJsonLd(
    p: PublicCatalogProduct,
    canonical: string,
    siteOrigin: string,
    precioFinal: number
): Record<string, unknown> {
    const images = getProductImages(p).map(src => absoluteFromSite(src, siteOrigin)).filter(Boolean)
    const availability =
        p.stock <= 0
            ? 'https://schema.org/OutOfStock'
            : 'https://schema.org/InStock'

    const brandName = p.brand?.trim()
    const description = p.brand?.trim()
        ? `${p.name} · ${p.brand.trim()}`
        : p.name

    const product: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.name,
        description,
        image: images.length ? images : undefined,
        sku: String(p.id),
        offers: {
            '@type': 'Offer',
            url: canonical,
            priceCurrency: 'ARS',
            price: precioFinal,
            availability,
            itemCondition: 'https://schema.org/NewCondition',
            seller: {
                '@type': 'Organization',
                name: MERCHANT_NAME,
            },
        },
    }

    if (brandName) {
        product.brand = { '@type': 'Brand', name: brandName }
    }

    return product
}

export function buildProductBreadcrumbJsonLd(
    canonical: string,
    siteOrigin: string,
    productName: string
): Record<string, unknown> {
    const origin = siteOrigin.replace(/\/$/, '')
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: 'Catálogo',
                item: `${origin}/catalogo`,
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: productName,
                item: canonical,
            },
        ],
    }
}
