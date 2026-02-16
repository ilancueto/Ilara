'use client'

import { X, CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react'
import { useEffect } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastData {
    id: string
    type: ToastType
    message: string
    duration?: number
}

interface ToastProps extends ToastData {
    onClose: (id: string) => void
}

const toastConfig = {
    success: {
        icon: CheckCircle2,
        bgColor: 'bg-white/95 backdrop-blur-xl',
        borderColor: 'border-emerald-200',
        iconColor: 'text-emerald-500',
        textColor: 'text-gray-800'
    },
    error: {
        icon: XCircle,
        bgColor: 'bg-white/95 backdrop-blur-xl',
        borderColor: 'border-red-200',
        iconColor: 'text-red-500',
        textColor: 'text-gray-800'
    },
    warning: {
        icon: AlertCircle,
        bgColor: 'bg-white/95 backdrop-blur-xl',
        borderColor: 'border-amber-200',
        iconColor: 'text-amber-500',
        textColor: 'text-gray-800'
    },
    info: {
        icon: Info,
        bgColor: 'bg-white/95 backdrop-blur-xl',
        borderColor: 'border-blue-200',
        iconColor: 'text-blue-500',
        textColor: 'text-gray-800'
    }
}

export default function Toast({ id, type, message, duration = 4000, onClose }: ToastProps) {
    const config = toastConfig[type]
    const Icon = config.icon

    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => onClose(id), duration)
            return () => clearTimeout(timer)
        }
    }, [id, duration, onClose])

    return (
        <div
            className={`flex items-start gap-3 p-4 rounded-2xl border shadow-lg ${config.bgColor} ${config.borderColor} ${config.textColor} animate-slide-in-right min-w-[300px] max-w-md`}
        >
            <Icon className={`w-5 h-5 ${config.iconColor} flex-shrink-0 mt-0.5`} />

            <p className="flex-1 text-sm font-medium leading-relaxed">
                {message}
            </p>

            <button
                onClick={() => onClose(id)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                aria-label="Cerrar"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    )
}
