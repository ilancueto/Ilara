'use client'

import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface ModalConfirmacionVaciarProps {
    open: boolean
    onClose: () => void
    onConfirm: () => void
}

export function ModalConfirmacionVaciar({ open, onClose, onConfirm }: ModalConfirmacionVaciarProps) {
    return (
        <ConfirmDialog
            open={open}
            onClose={onClose}
            onConfirm={onConfirm}
            title="¿Vaciar carrito?"
            description="Se eliminarán todos los productos. Esta acción no se puede deshacer."
            confirmLabel="Vaciar"
            cancelLabel="Cancelar"
            danger
            testId="modal-vaciar-carrito"
        />
    )
}
