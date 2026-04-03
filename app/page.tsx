import type { Metadata } from 'next'
import HomePageClient from './home-page-client'
import { getSiteUrl } from '@/lib/site'

const root = getSiteUrl().replace(/\/$/, '')

/** Solo para `/`: el layout raíz ya no define canonical global (evita herencia errónea en /login, etc.). */
export const metadata: Metadata = {
    alternates: { canonical: `${root}/` },
    robots: { index: false, follow: false },
}

export default function Page() {
    return <HomePageClient />
}
