'use client'

import PuntoVenta from './PuntoVenta/PuntoVenta'

export default function Ventas() {
    return (
        <div className="flex flex-col gap-5 sm:gap-6 animate-fade-in pb-2">
            <div className="min-w-0">
                <h2 className="font-serif text-[1.85rem] sm:text-[2.1rem] font-semibold tracking-tight text-[#1A181E] dark:text-gray-50">
                    Punto de venta
                </h2>
                <p className="text-sm text-[#635F69] dark:text-gray-400 mt-1 font-medium">
                    Catálogo táctil · multi-pago · crédito
                </p>
            </div>
            <PuntoVenta />
        </div>
    )
}
