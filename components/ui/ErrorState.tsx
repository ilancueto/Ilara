'use client'

type ErrorStateProps = {
  title?: string
  message?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

/**
 * Estado de error/reintento uniforme (Stage 4).
 */
export function ErrorState({
  title = 'Algo salió mal',
  message = 'Ocurrió un error inesperado. Podés intentar de nuevo.',
  onRetry,
  retryLabel = 'Reintentar',
  className = '',
}: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-6 ${className}`}
      role="alert"
      data-testid="error-state"
    >
      <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-100 mb-2">
        {title}
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md text-sm sm:text-base">
        {message}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="px-6 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold shadow-lg shadow-pink-200/50 hover:shadow-xl transition-all"
          data-testid="error-state-retry"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  )
}
