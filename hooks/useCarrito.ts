'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Producto, ItemCarrito } from '@/lib/supabase'

const STORAGE_KEY = 'ilara-carrito'

type ShowToast = (type: 'success' | 'error' | 'warning' | 'info', message: string) => void

type PendingToast = { type: 'success' | 'warning' | 'info'; message: string }

export function useCarrito(showToast: ShowToast) {
    const [carrito, setCarrito] = useState<ItemCarrito[]>([])
    const [badgeAnimado, setBadgeAnimado] = useState(false)
    const pendingToastRef = useRef<PendingToast | null>(null)

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (raw) setCarrito(JSON.parse(raw))
        } catch (e) {
            console.error('Error al cargar carrito:', e)
        }
    }, [])

    useEffect(() => {
        if (carrito.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(carrito))
        } else {
            localStorage.removeItem(STORAGE_KEY)
        }
    }, [carrito])

    // Mostrar toast pendiente una sola vez cuando el carrito cambia (evita duplicado en Strict Mode)
    useEffect(() => {
        const pending = pendingToastRef.current
        if (pending) {
            pendingToastRef.current = null
            showToast(pending.type, pending.message)
        }
    }, [carrito, showToast])

    const agregarAlCarrito = useCallback((producto: Producto) => {
        setCarrito(prev => {
            const existente = prev.find(item => item.producto.id === producto.id)
            if (existente) {
                if (existente.cantidad >= producto.stock) {
                    pendingToastRef.current = { type: 'warning', message: 'Stock máximo alcanzado' }
                    return [...prev]
                }
                pendingToastRef.current = { type: 'success', message: 'Cantidad actualizada' }
                return prev.map(item =>
                    item.producto.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
                )
            }
            pendingToastRef.current = { type: 'success', message: `${producto.name} agregado` }
            return [...prev, { producto, cantidad: 1 }]
        })
        setBadgeAnimado(true)
        setTimeout(() => setBadgeAnimado(false), 500)
    }, [showToast])

    const actualizarCantidad = useCallback((productoId: number, cambio: number) => {
        setCarrito(prev => prev.map(item => {
            if (item.producto.id !== productoId) return item
            const nuevaCantidad = item.cantidad + cambio
            if (nuevaCantidad <= 0) {
                pendingToastRef.current = { type: 'info', message: 'Producto eliminado' }
                return { ...item, cantidad: 0 }
            }
            if (nuevaCantidad > item.producto.stock) {
                pendingToastRef.current = { type: 'warning', message: 'Stock máximo alcanzado' }
                return { ...item }
            }
            return { ...item, cantidad: nuevaCantidad }
        }).filter(item => item.cantidad > 0))
    }, [showToast])

    const quitarDelCarrito = useCallback((productoId: number) => {
        setCarrito(prev => prev.filter(item => item.producto.id !== productoId))
        showToast('info', 'Producto eliminado')
    }, [showToast])

    const clearCarrito = useCallback(() => {
        setCarrito([])
    }, [])

    return {
        carrito,
        agregarAlCarrito,
        quitarDelCarrito,
        actualizarCantidad,
        clearCarrito,
        badgeAnimado,
    }
}
