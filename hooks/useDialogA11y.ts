'use client'

import { useEffect, type RefObject } from 'react'

/**
 * Escape cierra el diálogo; foco inicial en el panel; trap de Tab; al cerrar restaura foco previo.
 */
export function useDialogA11y(
  open: boolean,
  onClose: () => void,
  panelRef: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!open) return

    const focusSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const root = panelRef.current
      if (!root) return
      const focusable = [...root.querySelectorAll<HTMLElement>(focusSelector)].filter(
        (el) => el.offsetParent !== null || el.getClientRects().length > 0
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const previous = document.activeElement as HTMLElement | null

    const id = requestAnimationFrame(() => {
      const root = panelRef.current
      if (!root) return
      const focusable = root.querySelector<HTMLElement>(focusSelector)
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
