'use client'

import Image from 'next/image'
import { X } from 'lucide-react'

interface ModalImagenPreviaProps {
    imageUrl: string
    onClose: () => void
}

export function ModalImagenPrevia({ imageUrl, onClose }: ModalImagenPreviaProps) {
    return (
        <div className="fixed inset-0 z-[80] bg-black/95 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Vista previa de imagen">
            <button onClick={onClose} className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10" aria-label="Cerrar">
                <X className="w-6 h-6" />
            </button>
            <div className="relative w-full max-w-2xl aspect-square" onClick={e => e.stopPropagation()}>
                <Image src={imageUrl} alt="Vista previa" fill className="object-contain rounded-2xl" />
            </div>
        </div>
    )
}
