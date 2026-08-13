'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import ThemeSwitch from '@/components/ThemeSwitch'

type Props = { id: number; canonicalPath: string }

/**
 * Fallback cuando el fetch SSR de la ficha falla: `router.refresh()` vuelve a ejecutar el Server Component.
 */
export function ProductoCatalogoRecover({ id, canonicalPath }: Props) {
  const router = useRouter()

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-pink-50/30 via-white to-pink-50/20 dark:from-[#08080b] dark:via-[#060609] dark:to-[#08080b]">
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#08080b]/80 backdrop-blur-md border-b border-pink-100/40 dark:border-gray-800/30">
        <div className="w-full px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          <Link
            href="/catalogo"
            className="inline-flex items-center gap-2 text-sm font-semibold text-pink-600 dark:text-pink-400 hover:underline min-w-0"
          >
            <ChevronLeft className="w-5 h-5 shrink-0" />
            <span className="truncate">Catálogo</span>
          </Link>
          <ThemeSwitch />
        </div>
      </header>
      <main className="w-full max-w-lg mx-auto px-4 sm:px-6 py-16 text-center">
          <h1 className="text-gray-800 dark:text-gray-100 font-semibold mb-2">
            Producto no encontrado
          </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          Puede ser un fallo temporal del servidor. Podés reintentar o volver al catálogo.
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-6 font-mono truncate" title={canonicalPath}>
          #{id}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-pink-500 text-white font-semibold text-sm hover:bg-pink-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reintentar
          </button>
          <Link
            href="/catalogo"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-pink-200 dark:border-gray-600 text-pink-600 dark:text-pink-400 font-semibold text-sm hover:bg-pink-50 dark:hover:bg-gray-800 transition-colors"
          >
            Ir al catálogo
          </Link>
        </div>
      </main>
    </div>
  )
}
