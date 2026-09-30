import { NextResponse } from 'next/server'
import { fetchCatalogProductsServer } from '@/lib/catalog/serverCatalog'
import { createSupabasePublicClient } from '@/lib/supabase/public'
import { getSiteUrl } from '@/lib/site'
import { buildCatalogSitemap } from '@/lib/catalog/sitemapXml'
import { localSitemapFault } from '@/lib/catalog/localSeoFault'

/** XML en /sitemap.xml vía rewrite (evita depender solo del convenio metadata `sitemap.ts` en algunos deploys). */
export async function GET() {
    const base = getSiteUrl().replace(/\/$/, '')
    const fault = localSitemapFault()
    if (fault === 'error') {
        const fail = buildCatalogSitemap(base, null)
        return new NextResponse(fail.body, { status: fail.status, headers: fail.headers })
    }
    if (fault === 'empty') {
        const empty = buildCatalogSitemap(base, [])
        return new NextResponse(empty.body, { status: empty.status, headers: empty.headers })
    }

    try {
        const supabase = createSupabasePublicClient()
        const pr = await fetchCatalogProductsServer(supabase)
        if (!pr.ok) {
            const fail = buildCatalogSitemap(base, null)
            return new NextResponse(fail.body, { status: fail.status, headers: fail.headers })
        }
        const ok = buildCatalogSitemap(base, pr.data.map((p) => ({ id: p.id })))
        return new NextResponse(ok.body, { status: ok.status, headers: ok.headers })
    } catch {
        const fail = buildCatalogSitemap(base, null)
        return new NextResponse(fail.body, { status: fail.status, headers: fail.headers })
    }
}
