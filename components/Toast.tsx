'use client'

import { X, CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react'
import { useEffect, useState } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastAction {
    label: string
    onClick: () => void
}

export interface ToastData {
    id: string
    type: ToastType
    message: string
    duration?: number
    action?: ToastAction
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

export default function Toast({ id, type, message, duration = 4000, action, onClose }: ToastProps) {
    const config = toastConfig[type]
    const Icon = config.icon
    const [isExiting, setIsExiting] = useState(false)

    const runExitAndClose = () => {
        if (isExiting) return
        setIsExiting(true)
        setTimeout(() => onClose(id), 220)
    }

    useEffect(() => {
        if (duration <= 0) return
        const timer = setTimeout(() => {
            setIsExiting(true)
            setTimeout(() => onClose(id), 220)
        }, duration)
        return () => clearTimeout(timer)
    }, [id, duration, onClose])

    const handleAction = () => {
        action?.onClick()
        runExitAndClose()
    }

    return (
        <div
            className={`flex items-start gap-3 p-4 rounded-2xl border shadow-lg dark:bg-gray-800/95 dark:border-gray-600 ${config.bgColor} ${config.borderColor} ${config.textColor} dark:text-gray-100 min-w-[300px] max-w-md transition-all duration-200 ${isExiting ? 'animate-toast-out' : 'animate-slide-in-right'}`}
        >
            <Icon className={`w-5 h-5 ${config.iconColor} flex-shrink-0 mt-0.5`} />

            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-relaxed">
                    {message}
                </p>
                {action && (
                    <button
                        type="button"
                        onClick={handleAction}
                        className="mt-2.5 text-sm font-semibold text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-1 rounded"
                    >
                        {action.label}
                    </button>
                )}
            </div>

            <button
                onClick={runExitAndClose}
                className="flex-shrink-0 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Cerrar"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    )
}
