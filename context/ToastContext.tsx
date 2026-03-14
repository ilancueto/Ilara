'use client'

import { createContext, useContext, useState, ReactNode, useCallback } from 'react'
import Toast, { ToastData, ToastType, ToastAction } from '@/components/Toast'

interface ToastContextType {
    showToast: (type: ToastType, message: string, duration?: number, action?: ToastAction) => void
    showSuccess: (message: string, duration?: number, action?: ToastAction) => void
    showError: (message: string, duration?: number) => void
    showWarning: (message: string, duration?: number) => void
    showInfo: (message: string, duration?: number) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastData[]>([])

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== id))
    }, [])

    const showToast = useCallback((type: ToastType, message: string, duration = 4000, action?: ToastAction) => {
        const id = Math.random().toString(36).substring(2, 9)
        const newToast: ToastData = { id, type, message, duration, action }

        setToasts(prev => [...prev, newToast])
    }, [])

    const showSuccess = useCallback((message: string, duration?: number, action?: ToastAction) => {
        showToast('success', message, duration, action)
    }, [showToast])

    const showError = useCallback((message: string, duration?: number) => {
        showToast('error', message, duration)
    }, [showToast])

    const showWarning = useCallback((message: string, duration?: number) => {
        showToast('warning', message, duration)
    }, [showToast])

    const showInfo = useCallback((message: string, duration?: number) => {
        showToast('info', message, duration)
    }, [showToast])

    return (
        <ToastContext.Provider value={{ showToast, showSuccess, showError, showWarning, showInfo }}>
            {children}

            {/* Toast Container */}
            <div className="fixed top-4 right-4 z-[200] flex flex-col gap-3 pointer-events-none">
                {toasts.map(toast => (
                    <div key={toast.id} className="pointer-events-auto">
                        <Toast {...toast} onClose={removeToast} />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}

export function useToast() {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within ToastProvider')
    }
    return context
}
