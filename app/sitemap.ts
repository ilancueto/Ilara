import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { fetchCatalogProductsServer } from '@/lib/catalog/serverCatalog'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const base = getSiteUrl().replace(/\/$/, '')
    const lastModified = new Date()

    const staticEntries: MetadataRoute.Sitemap = [
        {
            url: base,
            lastModified,
            changeFrequency: 'weekly',
            priority: 1,
        },
        {
            url: `${base}/catalogo`,
            lastModified,
            changeFrequency: 'daily',
            priority: 0.9,
        },
    ]

    try {
        const supabase = await createSupabaseServerClient()
        const pr = await fetchCatalogProductsServer(supabase)
        if (!pr.ok) return staticEntries
        const productEntries: MetadataRoute.Sitemap = pr.data.map((p) => ({
            url: `${base}/catalogo/p/${p.id}`,
            lastModified: p.updated_at ? new Date(p.updated_at) : lastModified,
            changeFrequency: 'weekly' as const,
            priority: 0.75,
        }))
        return [...staticEntries, ...productEntries]
    } catch {
        return staticEntries
    }
}
