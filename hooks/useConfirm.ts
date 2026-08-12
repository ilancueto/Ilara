'use client'

import { useCallback, useRef, useState } from 'react'

export type ConfirmOptions = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type Pending = ConfirmOptions & {
  resolve: (value: boolean) => void
}

/**
 * Reemplazo programático de window.confirm().
 * Si se llama confirm() mientras hay otro pendiente, el anterior resuelve false.
 */
export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null)
  const [loading, setLoading] = useState(false)
  const pendingRef = useRef<Pending | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      if (pendingRef.current) {
        pendingRef.current.resolve(false)
      }
      const next: Pending = { ...options, resolve }
      pendingRef.current = next
      setPending(next)
    })
  }, [])

  const close = useCallback((result: boolean) => {
    const current = pendingRef.current
    pendingRef.current = null
    setPending(null)
    setLoading(false)
    current?.resolve(result)
  }, [])

  const confirmProps = {
    open: Boolean(pending),
    title: pending?.title || '',
    description: pending?.description,
    confirmLabel: pending?.confirmLabel,
    cancelLabel: pending?.cancelLabel,
    danger: pending?.danger ?? true,
    loading,
    onClose: () => close(false),
    onConfirm: () => close(true),
  }

  return { confirm, confirmProps, setLoading }
}
