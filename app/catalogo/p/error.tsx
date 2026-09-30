'use client'

import { useEffect } from 'react'
import { ProductoCatalogoRecover } from '@/components/Catalogo/ProductoCatalogoRecover'

/**
 * Límite del segmento de ficha. Next responde 500 (comprobado; no es 503).
 * Sin robots noindex: un 5xx es transitorio y no ordena desindexar.
 */
export default function CatalogProductError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[catalog product]', error.digest || error.message)
  }, [error])

  return <ProductoCatalogoRecover onRetry={reset} />
}
