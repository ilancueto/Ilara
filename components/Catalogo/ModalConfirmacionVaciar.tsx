'use client'

import { useRef } from 'react'
import { PastelCard } from '@/components/ui/PastelCard'
import { useDialogA11y } from '@/hooks/useDialogA11y'

interface ModalConfirmacionVaciarProps {
    open: boolean
    onClose: () => void
    onConfirm: () => void
}

export function ModalConfirmacionVaciar({ open, onClose, onConfirm }: ModalConfirmacionVaciarProps) {
    const panelRef = useRef<HTMLDivElement>(null)
    useDialogA11y(open, onClose, panelRef)

    if (!open) return null
    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} aria-hidden />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-vaciar-titulo"
                className="relative z-10 w-full max-w-sm outline-none"
            >
            <PastelCard className="w-full max-w-sm p-8 z-50 text-center" noHover>
                <h3 id="modal-vaciar-titulo" className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">¿Vaciar carrito?</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Se eliminarán todos los productos. Esta acción no se puede deshacer.</p>
                <div className="flex gap-4">
                    <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                        Cancelar
                    </button>
                    <button type="button" onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
                        Vaciar
                    </button>
                </div>
            </PastelCard>
            </div>
        </div>
    )
}
