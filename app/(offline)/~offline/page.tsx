import type { Metadata } from 'next'
import { getSiteUrl } from '@/lib/site'

const base = getSiteUrl().replace(/\/$/, '')

export const metadata: Metadata = {
  alternates: { canonical: `${base}/~offline` },
  robots: { index: false, follow: false },
}

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-pink-50 to-gray-50 p-6 text-center">
      <span className="text-6xl mb-4">📡</span>
      <h1 className="text-xl font-bold text-gray-800 mb-2">Sin conexión</h1>
      <p className="text-gray-500 text-sm">Revisá tu conexión y volvé a intentar.</p>
    </div>
  )
}
