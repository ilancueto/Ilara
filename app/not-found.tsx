import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Página no encontrada',
  robots: { index: false, follow: false },
}

/**
 * 404 uniforme (Stage 4). Renderiza dentro del root layout.
 */
export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <p className="text-sm font-semibold tracking-widest uppercase text-pink-500 mb-2">
        Error 404
      </p>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-ink mb-3">
        Página no encontrada
      </h1>
      <p className="text-muted mb-8 max-w-md">
        La ruta no existe o ya no está disponible. Volvé al catálogo o al inicio
        de sesión.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/catalogo"
          className="px-6 py-3 rounded-full bg-primary hover:bg-primary-hover text-white font-bold"
        >
          Ir al catálogo
        </Link>
        <Link
          href="/login"
          className="px-6 py-3 rounded-2xl border border-line text-ink font-semibold hover:bg-canvas"
        >
          Iniciar sesión
        </Link>
      </div>
    </div>
  )
}
