'use client'

import { X, Sparkles } from 'lucide-react'
import { PastelCard } from '@/components/ui/PastelCard'

interface ModalEasterEggProps {
    open: boolean
    code?: string
    alreadyClaimed?: boolean
    onClose: () => void
}

export function ModalEasterEgg({ open, code, alreadyClaimed, onClose }: ModalEasterEggProps) {
    if (!open) return null
    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} aria-hidden />
            <PastelCard className="w-full max-w-sm p-8 z-50 text-center relative" noHover>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-lg" aria-label="Cerrar">
                    <X className="w-5 h-5" />
                </button>
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center mx-auto mb-5">
                    <Sparkles className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {alreadyClaimed ? '¡Ya lo habías encontrado!' : '¡Encontraste el easter egg!'}
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                    {alreadyClaimed
                        ? 'Tu cupón de 10% por única vez (este dispositivo) es:'
                        : 'Tu cupón de 10% por única vez:'}
                </p>
                {code && (
                    <p className="font-mono text-lg font-bold text-pink-600 bg-pink-50 rounded-xl py-3 px-4 mb-5 select-all">
                        {code}
                    </p>
                )}
                <p className="text-xs text-gray-500 mb-2">Usalo en el carrito al hacer tu pedido.</p>
                <button
                    onClick={onClose}
                    className="w-full py-3 rounded-xl bg-pink-500 text-white font-bold hover:bg-pink-600 transition-colors"
                >
                    Cerrar
                </button>
            </PastelCard>
        </div>
    )
}
