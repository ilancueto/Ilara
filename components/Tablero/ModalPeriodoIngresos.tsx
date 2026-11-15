'use client'

import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { Settings } from 'lucide-react'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import { PastelCard } from '@/components/ui/PastelCard'

export type PeriodoIngresos = 'total' | '7d' | '30d'

type Props = {
    periodo: PeriodoIngresos
    onSelect: (periodo: PeriodoIngresos) => void
    onClose: () => void
}

/** Selector del período de ingresos (modal en portal). Se monta sólo mientras está abierto. */
export default function ModalPeriodoIngresos({ periodo, onSelect, onClose }: Props) {
    const refModalPeriodo = useRef<HTMLDivElement>(null)
    useDialogA11y(true, onClose, refModalPeriodo)
    if (typeof document === 'undefined') return null
    return createPortal(
            <>
                <div className="modal-backdrop" onClick={() => onClose()} />
                <div
                    ref={refModalPeriodo}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="tablero-periodo-titulo"
                    className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[340px] z-[200] outline-none"
                >
                <PastelCard noHover className="p-6 !shadow-2xl rounded-3xl border border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-5">
                        <h3 id="tablero-periodo-titulo" className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                            <Settings className="w-5 h-5 text-pink-500 dark:text-pink-400" />
                            Período de ingresos
                        </h3>
                        <button
                            onClick={() => onClose()}
                            className="p-2 rounded-xl bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                            aria-label="Cerrar"
                        >
                            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        {(['total', '7d', '30d'] as const).map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => { onSelect(p); onClose() }}
                                className={`w-full text-left px-4 py-3 rounded-xl font-semibold text-sm transition-colors ${
                                    periodo === p
                                        ? 'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 border-2 border-pink-300 dark:border-pink-700'
                                        : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-pink-50 dark:hover:bg-pink-900/20 hover:text-pink-600 dark:hover:text-pink-400 border-2 border-transparent'
                                }`}
                            >
                                {p === 'total' ? 'Total' : p === '7d' ? 'Últimos 7 días' : 'Últimos 30 días'}
                            </button>
                        ))}
                    </div>
                </PastelCard>
                </div>
            </>,
        document.body
    )
}
