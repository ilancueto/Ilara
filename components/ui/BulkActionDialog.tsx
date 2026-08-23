'use client'

/**
 * Diálogo accesible para acciones bulk (selección + confirmación).
 * Usa Dialog unificado (focus trap, Escape, inert, scroll lock).
 */

import type { ReactNode } from 'react'
import { Dialog } from '@/components/ui/Dialog'

export type BulkActionDialogProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer: ReactNode
  /** Bloquea cierre por Escape/backdrop mientras procesa. */
  loading?: boolean
  /** Mensaje de error inline (no cierra el diálogo). */
  error?: string | null
  size?: 'sm' | 'md' | 'lg'
  testId?: string
}

export function BulkActionDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  loading = false,
  error = null,
  size = 'lg',
  testId = 'bulk-action-dialog',
}: BulkActionDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={loading ? () => {} : onClose}
      title={title}
      description={description}
      dismissible={!loading}
      size={size}
      testId={testId}
      footer={footer}
      className="!max-h-[min(90dvh,640px)] flex flex-col"
    >
      {error ? (
        <p
          role="alert"
          className="mb-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl px-3 py-2"
          data-testid={`${testId}-error`}
        >
          {error}
        </p>
      ) : null}
      <div className="min-h-0 max-h-[min(50dvh,360px)] overflow-y-auto -mx-1 px-1">
        {children}
      </div>
    </Dialog>
  )
}

export type BulkListItem = {
  id: string | number
  label: string
  meta?: string
  selected: boolean
  onToggle: () => void
}

type BulkSelectListProps = {
  items: BulkListItem[]
  allSelected: boolean
  onToggleAll: () => void
  emptyMessage?: string
  selectAllLabel?: string
  testId?: string
  /** Clase de selección activa (pink default). */
  accent?: 'pink' | 'violet'
}

const accentSelected = {
  pink: 'bg-pink-50/70 dark:bg-pink-900/25 border-pink-100/80 dark:border-pink-800/40',
  violet:
    'bg-violet-50/70 dark:bg-violet-900/25 border-violet-100/80 dark:border-violet-800/40',
}

const accentCheck = {
  pink: 'border-pink-300 text-pink-600 focus:ring-pink-500',
  violet: 'border-violet-300 text-violet-600 focus:ring-violet-500',
}

/**
 * Lista de checkboxes accesible para bulk.
 */
export function BulkSelectList({
  items,
  allSelected,
  onToggleAll,
  emptyMessage = 'No hay elementos para mostrar.',
  selectAllLabel = 'Seleccionar todos',
  testId = 'bulk-select-list',
  accent = 'pink',
}: BulkSelectListProps) {
  return (
    <div data-testid={testId}>
      <label className="flex items-center gap-3 min-h-[44px] px-3 py-2 rounded-xl hover:bg-pink-50/50 dark:hover:bg-gray-700/50 cursor-pointer mb-2">
        <input
          type="checkbox"
          checked={items.length > 0 && allSelected}
          onChange={onToggleAll}
          disabled={items.length === 0}
          className={`rounded shrink-0 ${accentCheck[accent]}`}
          data-testid={`${testId}-select-all`}
          data-dialog-initial-focus
        />
        <span className="font-bold text-sm text-gray-700 dark:text-gray-200">
          {selectAllLabel}
        </span>
      </label>
      <div className="space-y-1.5" role="group" aria-label="Elementos seleccionables">
        {items.length === 0 ? (
          <p className="text-gray-400 dark:text-gray-500 text-sm py-4">{emptyMessage}</p>
        ) : (
          items.map((item) => (
            <label
              key={String(item.id)}
              className={`flex items-center gap-3 min-h-[44px] px-3 py-2 rounded-xl cursor-pointer border transition-colors ${
                item.selected
                  ? accentSelected[accent]
                  : 'bg-transparent border-transparent hover:bg-pink-50/50 dark:hover:bg-gray-700/50'
              }`}
            >
              <input
                type="checkbox"
                checked={item.selected}
                onChange={item.onToggle}
                className={`rounded shrink-0 ${accentCheck[accent]}`}
                data-testid={`${testId}-item-${item.id}`}
              />
              <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100 truncate min-w-0">
                {item.label}
              </span>
              {item.meta ? (
                <span className="text-xs text-gray-600 dark:text-gray-300 flex-shrink-0 tabular-nums max-w-[45%] truncate">
                  {item.meta}
                </span>
              ) : null}
            </label>
          ))
        )}
      </div>
    </div>
  )
}
