/**
 * URL canónica del sitio (SEO, Open Graph, sitemap, robots).
 *
 * En Vercel, VERCEL_URL apunta al deployment *.vercel.app, no al dominio custom;
 * en producción usamos el dominio público salvo que definas NEXT_PUBLIC_SITE_URL.
 */
const DEFAULT_PRODUCTION_URL = 'https://ilara.com.ar'

export function getSiteUrl(): string {
    const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
    if (explicit) return explicit

    if (process.env.VERCEL_ENV === 'production') {
        return DEFAULT_PRODUCTION_URL
    }

    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`
    }

    const app = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '')
    if (app) return app

    return DEFAULT_PRODUCTION_URL
}
