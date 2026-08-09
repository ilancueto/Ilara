'use client'

import PuntoVenta from './PuntoVenta/PuntoVenta'

export default function Ventas() {
    return (
        <div className="flex flex-col gap-5 sm:gap-6 animate-fade-in pb-2">
            <div className="min-w-0">
                <h2 className="text-2xl sm:text-[1.65rem] font-extrabold tracking-tight text-gray-900 dark:text-gray-50">
                    Punto de venta
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
                    Multi-pago · crédito · combos
                </p>
            </div>
            <PuntoVenta />
        </div>
    )
}
