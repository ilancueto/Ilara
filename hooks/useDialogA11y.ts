'use client'

import { useEffect, type RefObject } from 'react'

/**
 * Escape cierra el diálogo; foco inicial en el panel; al cerrar restaura foco previo.
 * Sin trap de tab completo (evita dependencias extra); mejora UX con teclado.
 */
export function useDialogA11y(
  open: boolean,
  onClose: () => void,
  panelRef: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const previous = document.activeElement as HTMLElement | null

    const id = requestAnimationFrame(() => {
      const root = panelRef.current
      if (!root) return
      const focusable = root.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      focusable?.focus()
    })

    return () => {
      cancelAnimationFrame(id)
      document.removeEventListener('keydown', onKeyDown)
      if (previous && typeof previous.focus === 'function') {
        try {
          previous.focus()
        } catch {
          /* ignore */
        }
      }
    }
  }, [open, onClose, panelRef])
}
