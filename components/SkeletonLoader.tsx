'use client'

interface SkeletonProps {
    className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
    return (
        <div
            className={`rounded-lg bg-gray-100 ${className}`}
            style={{
                background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite linear'
            }}
        />
    )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex gap-4 pb-3 border-b border-pink-100">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 flex-1" />
            </div>

            {/* Rows */}
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex gap-4 items-center">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-28" />
                    <Skeleton className="h-10 flex-1" />
                </div>
            ))}
        </div>
    )
}

export function SkeletonCard() {
    return (
        <div className="bg-white rounded-2xl border border-pink-100 p-5 space-y-3 shadow-sm">
            <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-6 w-32" />
                </div>
            </div>
        </div>
    )
}

export function SkeletonProductGrid({ count = 6 }: { count?: number }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-pink-100 p-4 space-y-3 shadow-sm">
                    <Skeleton className="h-40 w-full rounded-lg" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <div className="flex gap-2 pt-2">
                        <Skeleton className="h-8 flex-1" />
                        <Skeleton className="h-8 w-20" />
                    </div>
                </div>
            ))}
        </div>
    )
}
