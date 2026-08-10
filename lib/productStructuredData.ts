import { getProductImages, type Producto } from '@/lib/supabase'

/** Marca en schema cuando el producto no tiene marca en DB (identificador para Google). */
export const SCHEMA_FALLBACK_BRAND = 'Ilara Beauty'

const MERCHANT_NAME = 'Ilara Beauty'

function absoluteFromSite(pathOrUrl: string, siteOrigin: string): string {
    const t = pathOrUrl.trim()
    if (!t) return ''
    if (/^https?:\/\//i.test(t)) return t
    return new URL(t.replace(/^\//, ''), `${siteOrigin.replace(/\/$/, '')}/`).href
}

/**
 * Política de devoluciones (Offer → hasMerchantReturnPolicy).
 * Debe coincidir con el texto visible en la ficha de producto.
 */
function merchantReturnPolicyForOffer(): object {
    return {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'AR',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 3,
        returnMethod: [
            'https://schema.org/ReturnInStore',
            'https://schema.org/ReturnByMail',
        ],
        returnFees: 'https://schema.org/FreeReturn',
    }
}

/**
 * Envío (Offer → shippingDetails): Argentina, sin cargo; alineado al texto visible de la ficha.
 * Plazos orientativos; coordinación por WhatsApp.
 */
function offerShippingDetailsArgentina(): object {
    return {
        '@type': 'OfferShippingDetails',
        shippingRate: {
            '@type': 'MonetaryAmount',
            value: 0,
            currency: 'ARS',
        },
        shippingDestination: {
            '@type': 'DefinedRegion',
            addressCountry: 'AR',
        },
        deliveryTime: {
            '@type': 'ShippingDeliveryTime',
            handlingTime: {
                '@type': 'QuantitativeValue',
                minValue: 0,
                maxValue: 2,
                unitCode: 'DAY',
            },
            transitTime: {
                '@type': 'QuantitativeValue',
                minValue: 1,
                maxValue: 7,
                unitCode: 'DAY',
            },
        },
    }
}

export function buildProductJsonLd(
    p: Producto,
    canonical: string,
    siteOrigin: string,
    precioFinal: number
): Record<string, unknown> {
    const images = getProductImages(p).map(src => absoluteFromSite(src, siteOrigin)).filter(Boolean)
    // Sin min_stock en DTO público: solo InStock / OutOfStock.
    const availability =
        p.stock <= 0
            ? 'https://schema.org/OutOfStock'
            : 'https://schema.org/InStock'

    const brandName = p.brand?.trim() || SCHEMA_FALLBACK_BRAND
    // Sin notes internas en superficie pública.
    const description = `${p.name} — ${MERCHANT_NAME}, Neuquén.`

    return {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.name,
        description,
        image: images.length ? images : undefined,
        brand: {
            '@type': 'Brand',
            name: brandName,
        },
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
            hasMerchantReturnPolicy: merchantReturnPolicyForOffer(),
            shippingDetails: offerShippingDetailsArgentina(),
        },
    }
}
