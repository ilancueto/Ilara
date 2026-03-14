'use client'

type LoaderVariant = 'spinner' | 'dots' | 'pulse'
type LoaderSize = 'sm' | 'md' | 'lg'

interface LoaderProps {
    text?: string
    variant?: LoaderVariant
    size?: LoaderSize
    inline?: boolean
}

export default function Loader({
    text = 'Cargando...',
    variant = 'spinner',
    size = 'md',
    inline = false
}: LoaderProps) {
    const sizeClasses = {
        sm: 'w-6 h-6',
        md: 'w-12 h-12',
        lg: 'w-16 h-16'
    }

    const containerClasses = inline
        ? 'inline-flex items-center gap-3'
        : 'flex flex-col items-center justify-center py-10 space-y-4 animate-fade-in'

    if (variant === 'dots') {
        return (
            <div className={containerClasses}>
                <div className="flex gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-pink-300 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                {text && !inline && (
                    <p className="text-sm font-medium text-gray-400 dark:text-gray-500 animate-pulse tracking-wide">
                        {text}
                    </p>
                )}
            </div>
        )
    }

    if (variant === 'pulse') {
        return (
            <div className={containerClasses}>
                <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-tr from-pink-400 to-purple-400 animate-pulse shadow-sm`}></div>
                {text && !inline && (
                    <p className="text-sm font-medium text-gray-400 dark:text-gray-500 animate-pulse tracking-wide">
                        {text}
                    </p>
                )}
            </div>
        )
    }

    // Default: spinner
    return (
        <div className={containerClasses}>
            <div className={`relative ${sizeClasses[size]}`}>
                {/* Outer rotating ring */}
                <div className="absolute inset-0 rounded-full border-4 border-t-pink-500 border-r-transparent border-b-purple-400 border-l-transparent animate-spin opacity-80"></div>

                {/* Inner pulsing orb */}
                <div className="absolute inset-3 rounded-full bg-pink-100 animate-pulse shadow-sm"></div>
            </div>

            {text && !inline && (
                <p className="text-sm font-medium text-gray-400 dark:text-gray-500 animate-pulse tracking-wide">
                    {text}
                </p>
            )}
        </div>
    )
}
