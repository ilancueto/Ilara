'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface ModalImagenPreviaProps {
    imageUrl?: string
    images?: string[]
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

    useEffect(() => {
        if (list.length === 0) return
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault()
                onClose()
            }
        }
        document.addEventListener('keydown', onKeyDown)
        const previous = document.activeElement as HTMLElement | null
        const id = requestAnimationFrame(() => {
            const root = panelRef.current
            const focusable = root?.querySelector<HTMLElement>(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
            focusable?.focus()
        })
        return () => {
            cancelAnimationFrame(id)
            document.removeEventListener('keydown', onKeyDown)
            if (previous && typeof previous.focus === 'function') {
                try {
                    previous.focus()
                } catch {
                    /* ignore */
                }
            }
        }
    }, [list.length, onClose])

    if (list.length === 0) return null

    const current = list[index]
    /** Misma caja máxima que la galería de la PDP (`ProductPublicDetailClient`). */
    const galleryMaxHeight = 'min(85vh, 720px)'

    return (
        <div
            ref={panelRef}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4 outline-none"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="Vista previa de imagen"
        >
            <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 z-10 rounded-full bg-white/15 p-3 text-white transition hover:bg-white/25 sm:right-6 sm:top-6"
                aria-label="Cerrar"
            >
                <X className="h-6 w-6" />
            </button>

            {list.length > 1 && (
                <>
                    <button
                        type="button"
                        onClick={e => {
                            e.stopPropagation()
                            goPrev()
                        }}
                        className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/15 p-3 text-white transition hover:bg-white/25 sm:left-4 sm:flex"
                        aria-label="Imagen anterior"
                    >
                        <ChevronLeft className="h-8 w-8" />
                    </button>
                    <button
                        type="button"
                        onClick={e => {
                            e.stopPropagation()
                            goNext()
                        }}
                        className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/15 p-3 text-white transition hover:bg-white/25 sm:right-4 sm:flex"
                        aria-label="Imagen siguiente"
                    >
                        <ChevronRight className="h-8 w-8" />
                    </button>
                </>
            )}

            <div
                className="relative h-auto w-full max-w-7xl"
                style={{ maxHeight: galleryMaxHeight }}
                onClick={e => e.stopPropagation()}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                <Image
                    src={current}
                    alt={`Vista previa ${index + 1} de ${list.length}`}
                    width={1200}
                    height={1200}
                    className="h-auto w-full object-contain"
                    style={{ maxHeight: galleryMaxHeight }}
                    sizes="100vw"
                />
            </div>

            {list.length > 1 && (
                <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
                    {list.map((_, i) => (
                        <span
                            key={i}
                            className={`h-2 w-2 rounded-full ${i === index ? 'bg-white' : 'bg-white/40'}`}
                            aria-hidden
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
