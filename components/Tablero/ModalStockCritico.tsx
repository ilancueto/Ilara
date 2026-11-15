'use client'

import { useRef } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { AlertTriangle } from 'lucide-react'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import { PastelCard } from '@/components/ui/PastelCard'
import { getProductImages, type Producto } from '@/lib/supabase'

type Props = {
    productos: Producto[]
    onClose: () => void
}

/** Lista de productos con stock crítico (modal en portal). Se monta sólo mientras está abierto. */
export default function ModalStockCritico({ productos, onClose }: Props) {
    const refModalAlertas = useRef<HTMLDivElement>(null)
    useDialogA11y(true, onClose, refModalAlertas)
    if (typeof document === 'undefined') return null
    return createPortal(
            <>
                <div className="modal-backdrop" onClick={() => onClose()} />
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 pointer-events-none">
                    <div
                        ref={refModalAlertas}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="tablero-alertas-titulo"
                        className="pointer-events-auto w-[90vw] max-w-[500px] max-h-[80vh] flex flex-col min-h-0 outline-none"
                    >
                <PastelCard noHover className="flex flex-col flex-1 min-h-0 overflow-hidden p-6 sm:p-8 !shadow-2xl">
                    <div className="flex justify-between items-center mb-5 flex-shrink-0">
                        <h3 id="tablero-alertas-titulo" className="text-xl font-bold text-ink flex items-center gap-2">
                            <AlertTriangle className="w-6 h-6 text-amber-500 dark:text-amber-400" />
                            Stock Crítico
                        </h3>
                        <button
                            onClick={() => onClose()}
                            className="p-2 rounded-xl bg-canvas hover:bg-gray-100 dark:hover:bg-gray-600 text-hint hover:text-muted transition-colors"
                        >
                            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0 pr-2 scrollbar-hide">
                        {productos.map(prod => (
                            <div key={prod.id} className="stock-critical-row flex items-center gap-4 min-h-[64px] px-4 py-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-900/20 border border-amber-100/50 dark:border-amber-800/30">
                                <div className="w-10 h-10 rounded-lg bg-white dark:bg-gray-700 flex-shrink-0 overflow-hidden flex items-center justify-center border border-amber-100/60 dark:border-amber-800/30">
                                    {(getProductImages(prod)[0]) ? (
                                        <Image src={getProductImages(prod)[0]} alt={prod.name} width={40} height={40} className="w-full h-full object-cover" />
                                    ) : (
                                        <AlertTriangle className="w-5 h-5 text-amber-300 dark:text-amber-500" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                                    <p className="font-semibold text-ink text-sm leading-tight truncate">{prod.name}</p>
                                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Mín: {prod.min_stock}</p>
                                </div>
                                <div className="stock-critical-widget flex-shrink-0 flex flex-col items-center justify-center min-w-[56px] py-1.5 px-2.5 rounded-lg bg-white/90 dark:bg-gray-700/90 border border-amber-100/60 dark:border-gray-600 self-center">
                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-semibold tracking-wider leading-none">Stock</span>
                                    <span className={`font-bold text-sm tabular-nums mt-0.5 leading-none ${prod.stock === 0 ? 'text-red-500 dark:text-red-400' : 'text-ink'}`}>{prod.stock}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-line flex-shrink-0 px-1">
                        <p className="text-xs text-muted font-medium text-center">
                            Se recomienda reponer stock lo antes posible
                        </p>
                    </div>
                </PastelCard>
                    </div>
                </div>
            </>,
        document.body
    )
}
