'use client'

import { useEffect } from 'react'
import { trackError, ObservabilityEvent } from '@/lib/observability'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    trackError(error, {
      event: ObservabilityEvent.CLIENT_ERROR,
      code: error.digest,
      meta: { boundary: 'app/global-error' },
    })
  }, [error])

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'system-ui, sans-serif',
          background: 'linear-gradient(180deg, #fdf2f8 0%, #fff 50%, #fdf2f8 100%)',
          color: '#1f2937',
        }}
      >
        <div style={{ maxWidth: 400, textAlign: 'center' }} role="alert">
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 8 }}>
            Algo salió mal
          </h1>
          <p style={{ color: '#6b7280', marginBottom: 24 }}>
            Ocurrió un error grave. Podés intentar recargar la página.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: '12px 24px',
              borderRadius: 16,
              background: 'linear-gradient(90deg, #ec4899, #f43f5e)',
              color: '#fff',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(236, 72, 153, 0.4)',
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  )
}
