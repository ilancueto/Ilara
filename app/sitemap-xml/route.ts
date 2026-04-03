import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { fetchCatalogProductsServer } from '@/lib/catalog/serverCatalog'
import { getEnv } from '@/lib/env'
import { getSiteUrl } from '@/lib/site'

function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}

/** XML en /sitemap.xml vía rewrite (evita depender solo del convenio metadata `sitemap.ts` en algunos deploys). */
export async function GET() {
    const base = getSiteUrl().replace(/\/$/, '')
    const today = new Date().toISOString().split('T')[0]

    const entries: { loc: string; lastmod: string; changefreq: string; priority: string }[] = [
        { loc: base, lastmod: today, changefreq: 'weekly', priority: '1.0' },
        { loc: `${base}/catalogo`, lastmod: today, changefreq: 'daily', priority: '0.9' },
    ]

    try {
        const supabase = createClient(
            getEnv('NEXT_PUBLIC_SUPABASE_URL'),
            getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
        )
        const pr = await fetchCatalogProductsServer(supabase)
        if (pr.ok) {
            for (const p of pr.data) {
                entries.push({
                    loc: `${base}/catalogo/p/${p.id}`,
                    lastmod: p.updated_at
                        ? new Date(p.updated_at).toISOString().split('T')[0]
                        : today,
                    changefreq: 'weekly',
                    priority: '0.75',
                })
            }
        }
    } catch {
        /* solo entradas estáticas */
    }

    const body =
        `<?xml version="1.0" encoding="UTF-8"?>` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
        entries
            .map(
                (u) =>
                    `<url><loc>${escapeXml(u.loc)}</loc><lastmod>${escapeXml(u.lastmod)}</lastmod>` +
                    `<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
            )
            .join('') +
        `</urlset>`

    return new NextResponse(body, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=0, must-revalidate',
        },
    })
}
