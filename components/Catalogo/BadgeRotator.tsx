'use client'

import { useState, useEffect, useRef } from 'react'

const BADGE_VISIBLE_MS = 3000
const BADGE_FADE_MS = 900

export function BadgeRotator({ badges }: { badges: Array<{ texto: string; clase: string }> }) {
    const [index, setIndex] = useState(0)
    const [opacity, setOpacity] = useState(1)
    const [visible, setVisible] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = containerRef.current?.closest('.group')
        if (!el) return
        const obs = new IntersectionObserver(
            ([e]) => setVisible(e.isIntersecting),
            { rootMargin: '100px', threshold: 0 }
        )
        obs.observe(el)
        return () => obs.disconnect()
    }, [])

    useEffect(() => {
        if (badges.length <= 1 || !visible) return
        let timeoutId: ReturnType<typeof setTimeout>
        const cycleMs = BADGE_VISIBLE_MS + BADGE_FADE_MS * 2
        const id = setInterval(() => {
            setOpacity(0)
            timeoutId = setTimeout(() => {
                setIndex(i => (i + 1) % badges.length)
                setOpacity(1)
            }, BADGE_FADE_MS)
        }, cycleMs)
        return () => {
            clearInterval(id)
            if (timeoutId) clearTimeout(timeoutId)
        }
    }, [badges.length, visible])
    if (badges.length === 0) return null
    const badge = badges[index]
    return (
        <div ref={containerRef} className="absolute top-4 left-4 min-w-0 max-w-[70%]">
            <span
                className={`inline-block px-3 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wider shadow-lg whitespace-nowrap ${badge.clase}`}
                style={{ opacity, transition: `opacity ${BADGE_FADE_MS}ms ease` }}
            >
                {badge.texto}
            </span>
        </div>
    )
}
