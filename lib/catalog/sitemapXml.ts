function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export type SitemapProduct = { id: number }

export type SitemapResult = {
  status: number
  body: string
  headers: Record<string, string>
}

/**
 * Sitemap de URLs indexables. Sin lastmod/changefreq/priority:
 * no hay fecha de modificación pública fiable y esos campos no son palanca SEO.
 * Si falla la consulta de productos, 503 para no reemplazar el inventario por una sola URL.
 */
export function buildCatalogSitemap(base: string, products: SitemapProduct[] | null): SitemapResult {
  const origin = base.replace(/\/$/, '')
  const xmlHeaders = {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=0, must-revalidate',
  }

  if (products == null) {
    return {
      status: 503,
      body: '<?xml version="1.0" encoding="UTF-8"?><error>Catalog unavailable</error>',
      headers: {
        ...xmlHeaders,
        // 5 min: más que la caché de datos del catálogo (60s) y de fichas (120s), sin retener un error.
        'Retry-After': '300',
        'Cache-Control': 'no-store',
      },
    }
  }

  const locs = [`${origin}/catalogo`, ...products.map((p) => `${origin}/catalogo/p/${p.id}`)]
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    locs.map((loc) => `<url><loc>${escapeXml(loc)}</loc></url>`).join('') +
    `</urlset>`

  return { status: 200, body, headers: xmlHeaders }
}
