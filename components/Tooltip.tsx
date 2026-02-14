'use client'

import { ReactNode, useState } from 'react'

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

interface TooltipProps {
    children: ReactNode
    content: string
    position?: TooltipPosition
    delay?: number
}

export default function Tooltip({
    children,
    content,
    position = 'top',
    delay = 300
}: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false)
    const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)

    const handleMouseEnter = () => {
        const id = setTimeout(() => setIsVisible(true), delay)
        setTimeoutId(id)
    }

    const handleMouseLeave = () => {
        if (timeoutId) clearTimeout(timeoutId)
        setIsVisible(false)
    }

    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2'
    }

    const arrowClasses = {
        top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-800',
        bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-800',
        left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-800',
        right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-800'
    }

    return (
        <div
            className="relative inline-block"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {children}

            {isVisible && (
                <div
                    className={`absolute ${positionClasses[position]} z-50 px-3 py-2 text-xs font-medium text-white whitespace-nowrap rounded-xl bg-gray-800 border border-pink-200/30 shadow-lg animate-fade-in`}
                    style={{ animationDuration: '0.2s' }}
                >
                    {content}
                    <div
                        className={`absolute ${arrowClasses[position]} w-0 h-0 border-4`}
                    />
                </div>
            )}
        </div>
    )
}
