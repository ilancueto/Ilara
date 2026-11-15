'use client'

import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { Banknote, CreditCard, FileText, Receipt } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import { PastelCard } from '@/components/ui/PastelCard'
import type { ItemVenta, Venta } from '@/lib/supabase'

function IconoMetodoPago({ metodo }: { metodo: string | null }) {
    switch (metodo) {
        case 'efectivo': return <Banknote className="w-4 h-4 text-green-500" />
        case 'tarjeta': return <CreditCard className="w-4 h-4 text-blue-500" />
        case 'transferencia': return <FileText className="w-4 h-4 text-purple-500" />
        default: return <Receipt className="w-4 h-4 text-gray-400" />
    }
}

type Props = {
    venta: Venta
    items: ItemVenta[]
    cargando: boolean
    onClose: () => void
}

/** Detalle de una venta reciente (modal en portal). Se monta sólo mientras está abierto. */
export default function ModalDetalleVenta({ venta: detalleVenta, items: itemsDetalleVenta, cargando: cargandoDetalleVenta, onClose }: Props) {
    const refDetalleVenta = useRef<HTMLDivElement>(null)
    useDialogA11y(true, onClose, refDetalleVenta)
    if (typeof document === 'undefined') return null
    return createPortal(
            <>
                <div className="modal-backdrop" onClick={() => onClose()} />
                <div
                    ref={refDetalleVenta}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="tablero-detalle-venta-titulo"
                    className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md max-h-[85vh] z-[200] outline-none"
                >
                <PastelCard noHover className="max-h-[85vh] overflow-hidden flex flex-col !shadow-2xl rounded-3xl border border-gray-200 dark:border-gray-700">
                    {/* Header: sale ID primary, date + payment as metadata */}
                    <div className="p-6 pb-5 border-b border-pink-100 dark:border-gray-700 flex-shrink-0 flex justify-between items-start gap-4">
                        <div className="flex flex-col gap-1.5 min-w-0">
                            <h3 id="tablero-detalle-venta-titulo" className="text-xl font-bold text-gray-800 dark:text-gray-100 tracking-tight">Venta #{detalleVenta.id}</h3>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-gray-500 dark:text-gray-400">
                                <span>{format(new Date(detalleVenta.created_at), "EEEE d MMM yyyy, HH:mm", { locale: es })}</span>
                                <span className="flex items-center gap-1.5">
                                    <IconoMetodoPago metodo={detalleVenta.payment_method} />
                                    <span className="font-medium capitalize">{detalleVenta.payment_method || '—'}</span>
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={() => onClose()}
                            className="p-2 rounded-xl bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-200 transition-colors flex-shrink-0"
                            aria-label="Cerrar"
                        >
                            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="p-6 overflow-y-auto flex-1 min-h-0 flex flex-col gap-6">
                        {/* Client + notes: info block */}
                        {(detalleVenta.customer_name?.trim() || detalleVenta.notes?.trim()) && (
                            <div className="flex flex-col gap-3 p-4 rounded-xl bg-gray-50/80 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
                                {detalleVenta.customer_name?.trim() && (
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</span>
                                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{detalleVenta.customer_name}</p>
                                    </div>
                                )}
                                {detalleVenta.notes?.trim() && (
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Comentarios</span>
                                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{detalleVenta.notes}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Product rows */}
                        {cargandoDetalleVenta ? (
                            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">Cargando detalle...</p>
                        ) : itemsDetalleVenta.length > 0 ? (
                            <div className="flex flex-col gap-0">
                                {itemsDetalleVenta.map((item, idx) => (
                                    <div key={idx} className="venta-detalle-row flex justify-between items-center gap-4 min-h-[52px] py-3 border-b border-gray-100 dark:border-gray-700/80 last:border-0">
                                        <div className="min-w-0 flex flex-col gap-0.5 justify-center">
                                            <p className="font-medium text-gray-800 dark:text-gray-100 text-sm leading-tight truncate">{item.product_name}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{item.quantity} × ${item.unit_price.toLocaleString()}</p>
                                        </div>
                                        <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm tabular-nums shrink-0">${item.subtotal.toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">Esta venta no tiene ítems registrados.</p>
                        )}
                    </div>

                    {/* Total: clear separation and prominence */}
                    <div className="flex-shrink-0 pt-6 pb-6 px-6 border-t-2 border-gray-200 dark:border-gray-700 bg-pink-50/50 dark:bg-gray-800/50 rounded-b-3xl">
                        <div className="flex justify-between items-center gap-4">
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Total</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-2xl tabular-nums">${detalleVenta.total.toLocaleString()}</span>
                        </div>
                    </div>
                </PastelCard>
                </div>
            </>,
        document.body
    )
}
