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
                <PastelCard noHover className="p-6 !shadow-2xl rounded-3xl border border-line">
                    <div className="flex justify-between items-center mb-5">
                        <h3 id="tablero-periodo-titulo" className="text-lg font-bold text-ink flex items-center gap-2">
                            <Settings className="w-5 h-5 text-accent" />
                            Período de ingresos
                        </h3>
                        <button
                            onClick={() => onClose()}
                            className="p-2 rounded-xl bg-canvas hover:bg-gray-100 dark:hover:bg-gray-600 text-hint hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
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
                                        ? 'bg-primary-soft text-primary-ink border-2 border-pink-300 dark:border-pink-700'
                                        : 'bg-canvas text-ink hover:bg-primary-soft hover:text-accent border-2 border-transparent'
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
