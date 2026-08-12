import type { Metadata } from 'next'
import { getSiteUrl } from '@/lib/site'

const base = getSiteUrl().replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Sin conexión',
  alternates: { canonical: `${base}/~offline` },
  robots: { index: false, follow: false },
}

/**
 * Página informativa: Ilara no funciona offline.
 * El service worker no precachea ni redirige aquí; solo es una ruta accesible online.
 */
export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-pink-50 to-gray-50 p-6 text-center">
      <span className="text-6xl mb-4" aria-hidden>
        📡
      </span>
      <h1 className="text-xl font-bold text-gray-800 mb-2">Ilara requiere internet</h1>
      <p className="text-gray-500 text-sm max-w-sm">
        Esta aplicación no funciona sin conexión. No se guardan ventas ni datos de
        catálogo para uso offline. Revisá tu red y volvé a intentar.
      </p>
    </div>
  )
}
