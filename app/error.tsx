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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-pink-50/30 via-white to-pink-50/20 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <ErrorState
        title="Algo salió mal"
        message="Ocurrió un error inesperado. Podés intentar de nuevo."
        onRetry={() => reset()}
      />
    </div>
  )
}
