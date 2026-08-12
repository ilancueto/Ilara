'use client'

import { Dialog } from '@/components/ui/Dialog'

export type ConfirmDialogProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Estilo destructivo (rojo). */
  danger?: boolean
  loading?: boolean
  testId?: string
}

/**
 * Sustituto accesible de window.confirm().
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  loading = false,
  testId = 'confirm-dialog',
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={loading ? () => {} : onClose}
      title={title}
      description={description}
      dismissible={!loading}
      size="sm"
      testId={testId}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-ghost flex-1 sm:flex-none px-4 py-3 rounded-xl"
            data-testid={`${testId}-cancel`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            data-dialog-initial-focus
            onClick={() => void onConfirm()}
            disabled={loading}
            className={[
              'flex-1 sm:flex-none px-4 py-3 rounded-xl font-bold transition-colors',
              danger
                ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50'
                : 'bg-pink-500 text-white hover:bg-pink-600',
            ].join(' ')}
            data-testid={`${testId}-confirm`}
          >
            {loading ? 'Procesando…' : confirmLabel}
          </button>
        </>
      }
    >
      {null}
    </Dialog>
  )
}
