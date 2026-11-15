'use client'

import PuntoVenta from './PuntoVenta/PuntoVenta'

export default function Ventas() {
    return (
        <div className="flex flex-col gap-5 sm:gap-6 animate-fade-in pb-2">
            <div className="min-w-0">
                <h2 className="text-[1.85rem] sm:text-[2.1rem] font-bold tracking-tight text-primary-ink">
                    Punto de venta
                </h2>
                <p className="text-sm text-muted mt-1 font-medium">
                    Catálogo táctil · multi-pago · crédito
                </p>
            </div>
            <PuntoVenta />
        </div>
    )
}
