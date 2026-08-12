'use client'

/**
 * Dialog accesible reutilizable (Stage 4 / A11Y-01).
 * - role="dialog" + aria-modal + labelledby/describedby
 * - Focus trap (Tab/Shift+Tab); Escape solo en el diálogo superior
 * - Restauración de foco al cerrar
 * - Backdrop + inert en hermanos del portal (fallback aria-hidden)
 * - Scroll lock; safe-area móvil
 *
 * Bulk destructivos usan BulkActionDialog (mismo stack Escape/inert).
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type MouseEvent,
} from 'react'
import { createPortal } from 'react-dom'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Stack LIFO de diálogos abiertos: Escape cierra solo el tope. */
const openDialogStack: Array<{ id: string; onEscape: () => void }> = []

/** Refcount de scroll-lock (varios diálogos anidados / Strict Mode). */
let scrollLockCount = 0
let savedBodyOverflow = ''
let savedBodyPaddingRight = ''

function isVisibleFocusable(el: HTMLElement): boolean {
  if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') {
    return false
  }
  if (el.tabIndex < -1) return false
  const style = window.getComputedStyle(el)
  if (style.visibility === 'hidden' || style.display === 'none') return false
  // offsetParent null puede pasar en position:fixed; usar rects
  const rect = el.getBoundingClientRect()
  return rect.width > 0 || rect.height > 0
}

export type DialogProps = {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  dismissible?: boolean
  size?: 'sm' | 'md' | 'lg'
  titleId?: string
  className?: string
  testId?: string
}

const sizeClass: Record<NonNullable<DialogProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissible = true,
  size = 'md',
  titleId: titleIdProp,
  className = '',
  testId = 'app-dialog',
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const portalRootRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const dialogInstanceId = useId()
  const autoTitleId = useId()
  const autoDescId = useId()
  const titleId = titleIdProp || autoTitleId
  const descId = description ? autoDescId : undefined

  const handleClose = useCallback(() => {
    if (dismissible) onClose()
  }, [dismissible, onClose])

  // Registro en stack + Escape solo del tope
  useEffect(() => {
    if (!open) return
    const entry = {
      id: dialogInstanceId,
      onEscape: () => {
        if (dismissible) onClose()
      },
    }
    openDialogStack.push(entry)
    return () => {
      const idx = openDialogStack.findIndex((d) => d.id === entry.id)
      if (idx >= 0) openDialogStack.splice(idx, 1)
    }
  }, [open, dialogInstanceId, dismissible, onClose])

  // Scroll lock + focus trap + keydown + inert + restore focus
  useEffect(() => {
    if (!open) return

    previousFocus.current = document.activeElement as HTMLElement | null
    if (scrollLockCount === 0) {
      savedBodyOverflow = document.body.style.overflow
      savedBodyPaddingRight = document.body.style.paddingRight
      const scrollbar = window.innerWidth - document.documentElement.clientWidth
      document.body.style.overflow = 'hidden'
      if (scrollbar > 0) {
        document.body.style.paddingRight = `${scrollbar}px`
      }
    }
    scrollLockCount += 1

    // Inert / aria-hidden en hijos directos del body excepto este portal
    const inerted: Array<{ el: HTMLElement; ariaHidden: string | null }> = []
    const applyInert = () => {
      const portal = portalRootRef.current
      Array.from(document.body.children).forEach((child) => {
        if (!(child instanceof HTMLElement)) return
        if (portal && (child === portal || child.contains(portal))) return
        if (child.dataset.ilaraDialogPortal === 'true') return
        inerted.push({ el: child, ariaHidden: child.getAttribute('aria-hidden') })
        if ('inert' in child) {
          try {
            ;(child as HTMLElement & { inert: boolean }).inert = true
          } catch {
            /* ignore */
          }
        }
        child.setAttribute('aria-hidden', 'true')
      })
    }
    const clearInert = () => {
      for (const { el, ariaHidden } of inerted) {
        if ('inert' in el) {
          try {
            ;(el as HTMLElement & { inert: boolean }).inert = false
          } catch {
            /* ignore */
          }
        }
        if (ariaHidden == null) el.removeAttribute('aria-hidden')
        else el.setAttribute('aria-hidden', ariaHidden)
      }
      inerted.length = 0
    }
    // rAF: el portal ya está montado
    const inertId = requestAnimationFrame(applyInert)

    const onKeyDown = (e: KeyboardEvent) => {
      const top = openDialogStack[openDialogStack.length - 1]
      if (!top || top.id !== dialogInstanceId) return

      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        top.onEscape()
        return
      }
      if (e.key !== 'Tab') return
      const root = panelRef.current
      if (!root) return
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        isVisibleFocusable
      )
      if (nodes.length === 0) {
        e.preventDefault()
        root.focus()
        return
      }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last || !root.contains(active)) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)

    const focusId = requestAnimationFrame(() => {
      const root = panelRef.current
      if (!root) return
      const preferred =
        root.querySelector<HTMLElement>('[data-dialog-initial-focus]') ||
        Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).find(isVisibleFocusable)
      ;(preferred || root).focus()
    })

    return () => {
      cancelAnimationFrame(inertId)
      cancelAnimationFrame(focusId)
      document.removeEventListener('keydown', onKeyDown, true)
      clearInert()
      scrollLockCount = Math.max(0, scrollLockCount - 1)
      if (scrollLockCount === 0) {
        document.body.style.overflow = savedBodyOverflow
        document.body.style.paddingRight = savedBodyPaddingRight
      }
      // Cada instancia restaurá el elemento que tenía foco al abrirse (apilado).
      const prev = previousFocus.current
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
        try {
          prev.focus()
        } catch {
          /* ignore */
        }
      }
    }
  }, [open, handleClose, dialogInstanceId])

  const onBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) handleClose()
  }

  if (!open) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={portalRootRef}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      data-testid={testId}
      data-ilara-dialog-portal="true"
    >
      <div
        className="absolute inset-0 bg-black/55 dark:bg-black/65 backdrop-blur-[2px]"
        onClick={onBackdropClick}
        aria-hidden="true"
        data-testid={`${testId}-backdrop`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className={[
          'relative z-10 w-full',
          sizeClass[size],
          'max-h-[min(92dvh,100%)] overflow-y-auto overscroll-contain',
          'rounded-t-2xl sm:rounded-2xl',
          'bg-white dark:bg-gray-800',
          'border border-gray-100 dark:border-gray-700',
          'shadow-xl outline-none',
          'p-5 sm:p-6',
          'pb-[max(1.25rem,env(safe-area-inset-bottom))]',
          'animate-fade-in-scale',
          className,
        ].join(' ')}
        data-testid={`${testId}-panel`}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2
            id={titleId}
            className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-snug"
          >
            {title}
          </h2>
          {dismissible && (
            <button
              type="button"
              onClick={handleClose}
              className="shrink-0 p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Cerrar"
              data-testid={`${testId}-close`}
            >
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
        {description ? (
          <div
            id={descId}
            className="text-sm text-gray-500 dark:text-gray-400 mb-4"
          >
            {description}
          </div>
        ) : null}
        <div className="text-gray-800 dark:text-gray-100">{children}</div>
        {footer ? (
          <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  )
}
