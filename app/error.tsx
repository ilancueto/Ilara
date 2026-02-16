'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-pink-50/30 via-white to-pink-50/20">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-2">
          Algo salió mal
        </h1>
        <p className="text-gray-600 mb-6">
          Ocurrió un error inesperado. Podés intentar de nuevo.
        </p>
        <button
          onClick={() => reset()}
          className="px-6 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold shadow-lg shadow-pink-200/50 hover:shadow-xl hover:shadow-pink-200/60 transition-all"
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}
