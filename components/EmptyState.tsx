'use client'

import { ShoppingCart, Sparkles, ArrowRight } from 'lucide-react'
import { PastelCard } from '@/components/ui/PastelCard'

interface EmptyStateProps {
    title: string
    description: string
    icon?: 'sales' | 'sparkles'
    actionText?: string
    onAction?: () => void
}

export default function EmptyState({
    title,
    description,
    icon = 'sparkles',
    actionText,
    onAction
}: EmptyStateProps) {
    const IconComponent = icon === 'sales' ? ShoppingCart : Sparkles

    return (
        <PastelCard className="text-center animate-fade-in-scale py-16 px-10 max-w-md mx-auto" noHover>
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-pink-100 to-purple-100 mb-6 animate-float">
                <IconComponent className="w-10 h-10 text-pink-400" strokeWidth={1.5} />
            </div>

            <h3 className="text-xl font-bold text-gray-800 mb-3 tracking-tight">
                {title}
            </h3>

            <p className="text-gray-500 text-sm leading-relaxed mb-6 max-w-xs mx-auto">
                {description}
            </p>

            {actionText && onAction && (
                <button
                    onClick={onAction}
                    className="btn-primary inline-flex items-center gap-2 group"
                >
                    {actionText}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
            )}

            <div className="mt-8 pt-6 border-t border-pink-100">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                    Próximamente
                </p>
            </div>
        </PastelCard>
    )
}
