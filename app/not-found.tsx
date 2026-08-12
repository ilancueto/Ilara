import Link from 'next/link'

/**
 * 404 uniforme (Stage 4). Renderiza dentro del root layout.
 */
export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <p className="text-sm font-semibold tracking-widest uppercase text-pink-500 mb-2">
        Error 404
      </p>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-3">
        Página no encontrada
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md">
        La ruta no existe o ya no está disponible. Volvé al catálogo o al inicio
        de sesión.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/catalogo"
          className="px-6 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold shadow-lg shadow-pink-200/40"
        >
          Ir al catálogo
        </Link>
        <Link
          href="/login"
          className="px-6 py-3 rounded-2xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Iniciar sesión
        </Link>
      </div>
    </div>
  )
}
