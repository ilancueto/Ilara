'use client'

import { useState } from 'react'
import { Receipt, History } from 'lucide-react'
import PuntoVenta from './PuntoVenta/PuntoVenta'
import HistorialVentas from './HistorialVentas'
import { PastelCard } from '@/components/ui/PastelCard'

export default function Ventas() {
    const [vistaActiva, setVistaActiva] = useState<'pos' | 'historial'>('pos')

    return (
        <div className="flex flex-col gap-10 animate-fade-in">
            {/* Sub navegación */}
            <div className="flex justify-center">
                <PastelCard className="!p-2 flex gap-1 rounded-[22px] mx-auto w-auto inline-flex shadow-md shadow-pink-100/50" noHover>
                    <button
                        onClick={() => setVistaActiva('pos')}
                        className={`
                            flex items-center gap-2 px-6 py-3 rounded-[18px] text-sm font-bold transition-all duration-300
                            ${vistaActiva === 'pos'
                                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-300/40'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-pink-50/60'
                            }
                        `}
                    >
                        <Receipt className="w-4 h-4" strokeWidth={2.5} />
                        Punto de Venta
                    </button>
                    <button
                        onClick={() => setVistaActiva('historial')}
                        className={`
                            flex items-center gap-2 px-6 py-3 rounded-[18px] text-sm font-bold transition-all duration-300
                            ${vistaActiva === 'historial'
                                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-300/40'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-pink-50/60'
                            }
                        `}
                    >
                        <History className="w-4 h-4" strokeWidth={2.5} />
                        Historial
                    </button>
                </PastelCard>
            </div>

            {/* Contenido */}
            {vistaActiva === 'pos' ? <PuntoVenta /> : <HistorialVentas />}
        </div>
    )
}
