import type { Metadata } from 'next'
import Login from '@/components/Login'
import { getSiteUrl } from '@/lib/site'

const base = getSiteUrl().replace(/\/$/, '')

export const metadata: Metadata = {
    alternates: { canonical: `${base}/login` },
    robots: { index: false, follow: true },
}

export default function LoginPage() {
    return <Login />
}
