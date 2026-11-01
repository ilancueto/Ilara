import type { Metadata } from 'next'
import {
  catalogViewPath,
  isCatalogViewIndexable,
  type CatalogViewState,
} from '@/lib/domain/catalog/catalogView'
import { getSiteUrl } from '@/lib/site'

const catalogDescription =
  'Catálogo de Ilara Beauty: precios, disponibilidad y pedidos online o por WhatsApp.'

const canonicalShareOrigin =
  process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '') ||
  'https://ilara.com.ar'

const shareOgImageUrl = new URL('/og-image.png', `${canonicalShareOrigin}/`).href

export function catalogAbsoluteUrl(view: CatalogViewState): string {
  const origin = getSiteUrl().replace(/\/$/, '')
  return `${origin}${catalogViewPath(view)}`
}

export function buildCatalogMetadata(view: CatalogViewState): Metadata {
  const canonical = catalogAbsoluteUrl(view)
  const indexable = isCatalogViewIndexable(view)
  const title = view.page > 1
    ? `Catálogo · página ${view.page}`
    : 'Catálogo'
  const ogTitle = view.page > 1
    ? `Catálogo · página ${view.page} | Ilara Beauty`
    : 'Ilara Beauty | Catálogo'

  return {
    title: view.page > 1 ? title : { absolute: ogTitle },
    description: catalogDescription,
    alternates: { canonical },
    robots: {
      index: indexable,
      follow: true,
    },
    openGraph: {
      siteName: 'Ilara Beauty',
      locale: 'es_AR',
      type: 'website',
      title: ogTitle,
      description: catalogDescription,
      url: canonical,
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
      title: ogTitle,
      description: catalogDescription,
      images: [shareOgImageUrl],
    },
  }
}
