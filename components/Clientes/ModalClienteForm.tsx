'use client'

import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { User, X } from 'lucide-react'
import { useDialogA11y } from '@/hooks/useDialogA11y'

export type ClienteFormData = {
    first_name: string
    last_name: string
    email: string
    phone: string
}

type Props = {
    editando: boolean
    formData: ClienteFormData
    onChange: (data: ClienteFormData) => void
    guardando: boolean
    onSubmit: (e: React.FormEvent) => void
    onClose: () => void
}

/** Alta / edición de cliente (modal en portal). Se monta sólo mientras está abierto. */
export default function ModalClienteForm({ editando, formData, onChange, guardando, onSubmit, onClose }: Props) {
    const refModalCliente = useRef<HTMLDivElement>(null)
    useDialogA11y(true, onClose, refModalCliente)
    if (typeof document === 'undefined') return null
    return createPortal(
            <>
                <div className="fixed inset-0 bg-black/50 dark:bg-black/60 z-[200] animate-fade-in" onClick={onClose} aria-hidden />
                <div
                    ref={refModalCliente}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="clientes-form-titulo"
                    className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md max-h-[90vh] flex flex-col z-[201] rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl overflow-hidden outline-none"
                >
                    <div className="flex items-center justify-between flex-shrink-0 p-6 sm:p-8 pb-4">
                        <h3 id="clientes-form-titulo" className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
                            <div className="p-2.5 bg-pink-100 dark:bg-pink-900/40 rounded-xl text-pink-600 dark:text-pink-400">
                                <User className="w-5 h-5" />
                            </div>
                            {editando ? 'Editar Cliente' : 'Nuevo Cliente'}
                        </h3>
                        <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" aria-label="Cerrar">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
                        <div className="flex-1 overflow-y-auto px-6 sm:px-8 pb-6 flex flex-col gap-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="form-label text-sm">Nombre <span className="text-pink-500">*</span></label>
                                    <input type="text" value={formData.first_name} onChange={(e) => onChange({ ...formData, first_name: e.target.value })} placeholder="Ej: María" required className="form-input rounded-xl h-11 px-4" />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="form-label text-sm">Apellido <span className="text-pink-500">*</span></label>
                                    <input type="text" value={formData.last_name} onChange={(e) => onChange({ ...formData, last_name: e.target.value })} placeholder="Ej: González" required className="form-input rounded-xl h-11 px-4" />
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="form-label text-sm">Email</label>
                                <input type="email" value={formData.email} onChange={(e) => onChange({ ...formData, email: e.target.value })} placeholder="cliente@ejemplo.com" className="form-input rounded-xl h-11 px-4" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="form-label text-sm">Teléfono / WhatsApp</label>
                                <input type="tel" value={formData.phone} onChange={(e) => onChange({ ...formData, phone: e.target.value })} placeholder="Ej: 299 123 4567" className="form-input rounded-xl h-11 px-4" />
                            </div>
                        </div>
                        <div className="flex-shrink-0 p-6 sm:p-8 pt-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex gap-4">
                            <button type="button" onClick={onClose} className="btn-ghost flex-1 py-3 rounded-xl">Cancelar</button>
                            <button type="submit" disabled={guardando} className="btn-primary flex-[2] py-3 rounded-xl shadow-lg shadow-pink-200 dark:shadow-pink-900/20 font-semibold">
                                {guardando ? 'Guardando...' : (editando ? 'Guardar Cambios' : 'Crear Cliente')}
                            </button>
                        </div>
                    </form>
                </div>
            </>,
        document.body
    )
}
