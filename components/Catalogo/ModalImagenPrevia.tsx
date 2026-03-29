'use client'

import { useState, useCallback, useRef } from 'react'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface ModalImagenPreviaProps {
    /** Una sola imagen (comportamiento anterior) o varias para galería */
    imageUrl?: string
    images?: string[]
    /** Índice inicial cuando hay varias imágenes */
    initialIndex?: number
    onClose: () => void
}

export function ModalImagenPrevia({ imageUrl, images, initialIndex = 0, onClose }: ModalImagenPreviaProps) {
    const list = images?.length ? images : imageUrl ? [imageUrl] : []
    const panelRef = useRef<HTMLDivElement>(null)
    const [index, setIndex] = useState(initialIndex >= 0 && initialIndex < list.length ? initialIndex : 0)
    const [touchStart, setTouchStart] = useState<number | null>(null)
    const [touchEnd, setTouchEnd] = useState<number | null>(null)

    const goPrev = useCallback(() => {
        setIndex(i => (i <= 0 ? list.length - 1 : i - 1))
    }, [list.length])

    const goNext = useCallback(() => {
        setIndex(i => (i >= list.length - 1 ? 0 : i + 1))
    }, [list.length])

    const onTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX)
    const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX)
    const onTouchEnd = () => {
        if (touchStart == null || touchEnd == null) return
        const diff = touchStart - touchEnd
        if (Math.abs(diff) > 50) {
            if (diff > 0) goNext()
            else goPrev()
        }
        setTouchStart(null)
        setTouchEnd(null)
    }

    useDialogA11y(list.length > 0, onClose, panelRef)

    if (list.length === 0) return null

    const current = list[index]

    return (
        <div
            ref={panelRef}
            className="fixed inset-0 z-[80] bg-black/95 flex items-center justify-center p-4 outline-none"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="Vista previa de imagen"
        >
            <button
                onClick={onClose}
                className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
                aria-label="Cerrar"
            >
                <X className="w-6 h-6" />
            </button>

            {list.length > 1 && (
                <>
                    <button
                        onClick={e => { e.stopPropagation(); goPrev() }}
                        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
                        aria-label="Imagen anterior"
                    >
                        <ChevronLeft className="w-8 h-8" />
                    </button>
                    <button
                        onClick={e => { e.stopPropagation(); goNext() }}
                        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
                        aria-label="Imagen siguiente"
                    >
                        <ChevronRight className="w-8 h-8" />
                    </button>
                </>
            )}

            <div
                className="relative w-full max-w-2xl aspect-square"
                onClick={e => e.stopPropagation()}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                <Image
                    src={current}
                    alt={`Vista previa ${index + 1} de ${list.length}`}
                    fill
                    className="object-contain rounded-2xl"
                />
            </div>

            {list.length > 1 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                    {list.map((_, i) => (
                        <span
                            key={i}
                            className={`w-2 h-2 rounded-full transition-colors ${i === index ? 'bg-white' : 'bg-white/40'}`}
                            aria-hidden
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
