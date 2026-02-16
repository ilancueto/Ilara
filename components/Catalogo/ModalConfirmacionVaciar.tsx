'use client'

import { PastelCard } from '@/components/ui/PastelCard'

interface ModalConfirmacionVaciarProps {
    open: boolean
    onClose: () => void
    onConfirm: () => void
}

export function ModalConfirmacionVaciar({ open, onClose, onConfirm }: ModalConfirmacionVaciarProps) {
    if (!open) return null
    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} aria-hidden />
            <PastelCard className="w-full max-w-sm p-8 z-50 text-center" noHover>
                <h3 className="text-xl font-bold text-gray-900 mb-2">¿Vaciar carrito?</h3>
                <p className="text-gray-500 text-sm mb-6">Se eliminarán todos los productos. Esta acción no se puede deshacer.</p>
                <div className="flex gap-4">
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors">
                        Cancelar
                    </button>
                    <button onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-red-50 text-red-600 font-bold hover:bg-red-100 transition-colors">
                        Vaciar
                    </button>
                </div>
            </PastelCard>
        </div>
    )
}
