import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import Catalogo from '@/components/Catalogo'
import { loadPublicCatalogSnapshot, loadPublicCatalogSales } from '@/lib/catalog/publicCatalogSnapshot'
import { buildCatalogMetadata, catalogAbsoluteUrl } from '@/lib/catalog/catalogSeo'
import { getShareSiteOrigin } from '@/lib/site'
import { serializeJsonLd } from '@/lib/security/serializeJsonLd'
import {
  catalogNormalizeRedirectPath,
  parseCatalogView,
} from '@/lib/domain/catalog/catalogView'
import { deriveCatalogListing } from '@/lib/domain/catalog/deriveCatalogListing'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * searchParams es Request-time: el HTML de cada consulta se renderiza en el request
 * y no se reutiliza el documento de otra URL. Los datos del catálogo se cachean
 * aparte (unstable_cache 60s) para no repetir lecturas ni mezclar resultados.
 */
export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = await searchParams
  const redirectTo = catalogNormalizeRedirectPath(sp)
  if (redirectTo) redirect(redirectTo)
  const view = parseCatalogView(sp)
  const snapshot = await loadPublicCatalogSnapshot()
  const sales = view.sort === 'vendidos-desc' ? await loadPublicCatalogSales() : []
  if (!snapshot.serverFetchFailed) {
    const listing = deriveCatalogListing({
      productos: snapshot.productos,
      combos: snapshot.combos,
      ventasPorProducto: new Map(sales),
      view,
    })
    if (listing.outOfRange) notFound()
  }
  return buildCatalogMetadata(view)
}

export default async function CatalogoPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const redirectTo = catalogNormalizeRedirectPath(sp)
  if (redirectTo) redirect(redirectTo)
  const view = parseCatalogView(sp)

  const snapshot = await loadPublicCatalogSnapshot()
  const sales = view.sort === 'vendidos-desc' ? await loadPublicCatalogSales() : []
  if (snapshot.serverFetchFailed) {
    noStore()
    return (
      <Catalogo
        initialCatalog={{
          productos: [],
          combos: [],
          categorias: [],
          serverFetchFailed: true,
        }}
        initialView={view}
      />
    )
  }

  const listing = deriveCatalogListing({
    productos: snapshot.productos,
    combos: snapshot.combos,
    ventasPorProducto: new Map(sales),
    view,
  })
  if (listing.outOfRange) notFound()

  const origin = getShareSiteOrigin()
  // Only describe products actually rendered on this page; combos have no public detail URL.
  const productsOnPage = listing.itemsPagina.filter((item) => 'stock' in item)
  const collection = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${catalogAbsoluteUrl(view)}#page`,
    url: catalogAbsoluteUrl(view),
    name: 'Catálogo de Ilara Beauty en Neuquén',
    inLanguage: 'es-AR',
    about: { '@id': `${origin}/#organization` },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: productsOnPage.map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: product.name,
        url: `${origin}/catalogo/p/${product.id}`,
      })),
    },
  }

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(collection) }} />
    <Catalogo
      initialCatalog={{
        productos: snapshot.productos,
        combos: snapshot.combos,
        categorias: snapshot.categorias,
        serverFetchFailed: false,
        sales: view.sort === 'vendidos-desc' ? sales : undefined,
      }}
      initialView={view}
    />
    </>
  )
}
