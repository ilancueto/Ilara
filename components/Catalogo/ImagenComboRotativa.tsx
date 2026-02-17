'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { ComboConItems, Producto } from '@/lib/supabase'
import { Sparkles } from 'lucide-react'

const ROTACION_MS = 5000

interface ImagenComboRotativaProps {
    combo: ComboConItems
    fill?: boolean
    className?: string
    sizes?: string
    onClick?: () => void
}

/** Muestra las imágenes de los productos del combo rotando cada 5 segundos */
export function ImagenComboRotativa({ combo, fill, className = '', sizes, onClick }: ImagenComboRotativaProps) {
    const [indice, setIndice] = useState(0)
    const visibleRef = useRef(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const imagenes = (combo.combo_items || [])
        .map(ci => (ci.products as Producto | undefined)?.image_url)
        .filter((url): url is string => !!url)

    const imagenCombo = combo.image_url
    const todasLasImagenes = imagenCombo ? [imagenCombo, ...imagenes] : imagenes

    useEffect(() => {
        const el = containerRef.current?.closest('.group') ?? containerRef.current
        if (!el) return
        const obs = new IntersectionObserver(
            ([e]) => { visibleRef.current = e.isIntersecting },
            { rootMargin: '50px', threshold: 0 }
        )
        obs.observe(el)
        return () => obs.disconnect()
    }, [])

    useEffect(() => {
        if (todasLasImagenes.length <= 1) return
        const id = setInterval(() => {
            setIndice(i => (i + 1) % todasLasImagenes.length)
        }, ROTACION_MS)
        return () => clearInterval(id)
    }, [todasLasImagenes.length])

    if (todasLasImagenes.length === 0) {
        return (
            <div
                ref={containerRef}
                className={`flex items-center justify-center bg-gray-50 ${className}`}
                onClick={onClick}
                role={onClick ? 'button' : undefined}
                tabIndex={onClick ? 0 : undefined}
                onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
            >
                <Sparkles className="w-16 h-16 text-pink-200" />
            </div>
        )
    }

    const img = todasLasImagenes[indice]

    return (
        <div ref={containerRef} className={`relative overflow-hidden bg-gray-50 ${className}`} onClick={onClick}>
            {fill ? (
                <Image
                    src={img}
                    alt=""
                    fill
                    className="object-cover transition-opacity duration-700"
                    sizes={sizes ?? '(max-width: 768px) 50vw, 25vw'}
                />
            ) : (
                <Image
                    src={img}
                    alt=""
                    width={400}
                    height={400}
                    className="w-full h-full object-cover transition-opacity duration-700"
                />
            )}
        </div>
    )
}
