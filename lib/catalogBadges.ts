/**
 * Badges del catálogo público: clave en DB (`products.catalog_badge`) y estilos.
 * `null` = automático (fecha de alta + % descuento).
 */

export type CatalogBadgeKey = 'nuevos' | 'descuento' | 'ultimas' | 'destacado' | 'edicion_limitada'

export type ProductoCamposBadge = {
    stock: number
    created_at: string
    discount_percentage?: number | null
    catalog_badge?: CatalogBadgeKey | null
}

export const CATALOG_BADGE_OPTIONS: {
    value: CatalogBadgeKey | 'auto'
    label: string
    hint: string
}[] = [
    {
        value: 'auto',
        label: 'Automático',
        hint: 'Según fecha de alta y descuento (como antes)',
    },
    {
        value: 'nuevos',
        label: 'NUEVOS',
        hint: 'Énfasis en producto recién incorporado',
    },
    {
        value: 'descuento',
        label: 'En descuento',
        hint: 'Promoción o rebaja (independiente del % en el formulario)',
    },
    {
        value: 'ultimas',
        label: 'Últimas unidades',
        hint: 'Urgencia por stock limitado',
    },
    {
        value: 'destacado',
        label: 'Destacado',
        hint: 'Producto estrella del mes',
    },
    {
        value: 'edicion_limitada',
        label: 'Edición limitada',
        hint: 'Colección o stock acotado',
    },
]

const BADGE_AGOTADO = {
    texto: 'Agotado',
    clase: 'bg-gray-500 text-white shadow-md shadow-gray-200/50',
}

const BADGE_DESCUENTO_AUTO = {
    texto: 'En descuento',
    clase: 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-300/40 dark:shadow-orange-900/30',
}

const BADGE_NOVEDAD = {
    texto: 'Novedad',
    clase:
        'bg-gradient-to-br from-fuchsia-500 via-pink-500 to-rose-600 text-white shadow-xl shadow-pink-500/35 dark:shadow-rose-900/50 ring-1 ring-white/25',
}

const BADGE_RECIEN = {
    texto: 'Recién llegó',
    clase:
        'bg-white/95 dark:bg-gray-800/95 text-pink-600 dark:text-pink-300 border border-pink-200/90 dark:border-pink-500/40 shadow-md shadow-pink-200/30 dark:shadow-black/40',
}

const MANUAL: Record<CatalogBadgeKey, { texto: string; clase: string }> = {
    nuevos: {
        texto: 'NUEVOS',
        clase:
            'bg-gradient-to-br from-fuchsia-600 via-pink-500 to-rose-500 text-white shadow-xl shadow-pink-500/40 ring-1 ring-white/20',
    },
    descuento: BADGE_DESCUENTO_AUTO,
    ultimas: {
        texto: 'Últimas unidades',
        clase: 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md shadow-amber-400/40',
    },
    destacado: {
        texto: 'Destacado',
        clase: 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/35',
    },
    edicion_limitada: {
        texto: 'Edición limitada',
        clase: 'bg-gradient-to-r from-slate-700 to-slate-900 text-amber-100 shadow-md border border-amber-500/40',
    },
}

function diasDesdeCarga(fecha: string): number {
    const ahora = new Date()
    const fechaProducto = new Date(fecha)
    return (ahora.getTime() - fechaProducto.getTime()) / (1000 * 3600 * 24)
}

/** Badges que se muestran en el catálogo (rotan si hay más de uno). */
export function getCatalogBadgesForProduct(producto: ProductoCamposBadge): Array<{ texto: string; clase: string }> {
    const badges: Array<{ texto: string; clase: string }> = []
    if (producto.stock === 0) {
        badges.push(BADGE_AGOTADO)
        return badges
    }

    const manual = producto.catalog_badge ?? null
    const tieneDescuento = (producto.discount_percentage ?? 0) > 0

    if (manual) {
        badges.push(MANUAL[manual])
        if (tieneDescuento && manual !== 'descuento') {
            badges.push(BADGE_DESCUENTO_AUTO)
        }
    } else {
        if (tieneDescuento) badges.push(BADGE_DESCUENTO_AUTO)
        const dias = diasDesdeCarga(producto.created_at)
        if (dias <= 5) {
            badges.push(BADGE_NOVEDAD)
        } else if (dias <= 21) {
            badges.push(BADGE_RECIEN)
        }
    }

    return badges
}

/** Etiqueta corta para panel (tabla / detalle). */
export function etiquetaBadgeCatalogo(catalog_badge: CatalogBadgeKey | null | undefined): string {
    if (catalog_badge == null) return 'Automático'
    const opt = CATALOG_BADGE_OPTIONS.find(o => o.value === catalog_badge)
    return opt?.label ?? catalog_badge
}
