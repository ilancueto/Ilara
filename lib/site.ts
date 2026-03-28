/**
 * URL canónica del sitio (SEO, Open Graph, sitemap, robots).
 * En Vercel: configurá NEXT_PUBLIC_SITE_URL=https://ilara.com.ar
 */
export function getSiteUrl(): string {
    const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
    if (explicit) return explicit
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
    const app = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '')
    if (app) return app
    return 'https://ilara.com.ar'
}
