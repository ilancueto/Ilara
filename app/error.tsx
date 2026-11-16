'use client'

import { useEffect } from 'react'
import { ErrorState } from '@/components/ui/ErrorState'
import { trackError, ObservabilityEvent } from '@/lib/observability'

export default function Error({
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
      meta: { boundary: 'app/error' },
    })
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <ErrorState
        title="Algo salió mal"
        message="Ocurrió un error inesperado. Podés intentar de nuevo."
        onRetry={() => reset()}
      />
    </div>
  )
}
