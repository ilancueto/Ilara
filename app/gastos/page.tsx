import type { Metadata } from 'next'
import GastosPageClient from './gastos-page-client'
import { getSiteUrl } from '@/lib/site'

const base = getSiteUrl().replace(/\/$/, '')

export const metadata: Metadata = {
    alternates: { canonical: `${base}/gastos` },
    robots: { index: false, follow: false },
}

export default function GastosPage() {
    return <GastosPageClient />
}
