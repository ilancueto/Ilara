import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
    const base = getSiteUrl()
    const lastModified = new Date()

    return [
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
}
