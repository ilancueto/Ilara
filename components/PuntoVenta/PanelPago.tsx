'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Cliente, PagoDesglose } from '@/lib/supabase'
import Loader from '../Loader'

const METODOS = [
    { id: 'efectivo' as const, label: 'Efectivo' },
    { id: 'transferencia' as const, label: 'Transf.' },
    { id: 'tarjeta' as const, label: 'Tarjeta' },
]

interface PanelPagoProps {
    total: number
    cantidadItems: number
    metodoPago: 'efectivo' | 'tarjeta' | 'transferencia'
    setMetodoPago: (m: 'efectivo' | 'tarjeta' | 'transferencia') => void
    paymentBreakdown: PagoDesglose[] | null
    setPaymentBreakdown: (p: PagoDesglose[] | null) => void
    clientes: Cliente[]
    clienteSeleccionado: number | null
    setClienteSeleccionado: (id: number | null) => void
    nombreClienteOtro: string
    setNombreClienteOtro: (v: string) => void
    notas: string
    setNotas: (notas: string) => void
    cobrarDespues: boolean
    setCobrarDespues: (v: boolean) => void
    onProcesar: () => void
    cargando: boolean
    disabled: boolean
}

export default function PanelPago({
    total,
    metodoPago,
    setMetodoPago,
    paymentBreakdown,
    setPaymentBreakdown,
    cobrarDespues,
    setCobrarDespues,
    onProcesar,
    cargando,
    disabled,
}: PanelPagoProps) {
    const pagoMixto = paymentBreakdown !== null
    const sumaDesglose = (paymentBreakdown || []).reduce((suma, pago) => suma + pago.amount, 0)
    const desgloseValido = !pagoMixto || Boolean(paymentBreakdown?.length && Math.abs(sumaDesglose - total) < 0.01)

    const elegirMetodo = (metodo: 'efectivo' | 'tarjeta' | 'transferencia') => {
        setCobrarDespues(false)
        setPaymentBreakdown(null)
        setMetodoPago(metodo)
    }

    const elegirMixto = () => {
        setCobrarDespues(false)
        if (!paymentBreakdown) {
            setPaymentBreakdown([
                { method: 'efectivo', amount: total },
                { method: 'transferencia', amount: 0 },
            ])
        }
    }

    const actualizarPago = (index: number, field: 'method' | 'amount', value: string) => {
        setPaymentBreakdown((paymentBreakdown || []).map((pago, i) => {
            if (i !== index) return pago
            return field === 'amount' ? { ...pago, amount: Number(value) || 0 } : { ...pago, method: value }
        }))
    }

    const quitarPago = (index: number) => {
        const siguiente = (paymentBreakdown || []).filter((_, i) => i !== index)
        setPaymentBreakdown(siguiente.length ? siguiente : null)
    }

    return (
        <div className="px-[1.1rem] pt-3.5 pb-[1.1rem] border-t border-pink-100/80 dark:border-white/10 bg-[#f8f4f8] dark:bg-zinc-950/55">
            {!cobrarDespues && (
                <div className="grid grid-cols-4 gap-1.5 mb-4" aria-label="Método de pago">
                    {METODOS.map((metodo) => {
                        const activo = !pagoMixto && metodoPago === metodo.id
                        return (
                            <button
                                key={metodo.id}
                                type="button"
                                onClick={() => elegirMetodo(metodo.id)}
                                className={`min-w-0 px-1 py-2 rounded-[10px] border text-[11px] font-bold transition-colors ${activo
                                    ? 'border-pink-400 bg-pink-50 text-pink-700 dark:border-pink-500 dark:bg-pink-950/40 dark:text-pink-300'
                                    : 'border-pink-100/80 bg-white text-gray-700 dark:border-white/10 dark:bg-zinc-900 dark:text-gray-300'
                                }`}
                            >
                                <span className="block truncate">{metodo.label}</span>
                            </button>
                        )
                    })}
                    <button
                        type="button"
                        onClick={elegirMixto}
                        className={`min-w-0 px-1 py-2 rounded-[10px] border text-[11px] font-bold transition-colors ${pagoMixto
                            ? 'border-pink-400 bg-pink-50 text-pink-700 dark:border-pink-500 dark:bg-pink-950/40 dark:text-pink-300'
                            : 'border-pink-100/80 bg-white text-gray-700 dark:border-white/10 dark:bg-zinc-900 dark:text-gray-300'
                        }`}
                    >
                        Mixto
                    </button>
                </div>
            )}

            {pagoMixto && !cobrarDespues && (
                <div className="mb-3 space-y-2">
                    {(paymentBreakdown || []).map((pago, index) => (
                        <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(88px,0.8fr)_28px] gap-1.5 items-center">
                            <select value={pago.method} onChange={(event) => actualizarPago(index, 'method', event.target.value)} className="h-9 min-w-0 rounded-lg border border-pink-100 dark:border-white/10 bg-white dark:bg-zinc-900 px-2 text-xs font-semibold">
                                {METODOS.map((metodo) => <option key={metodo.id} value={metodo.id}>{metodo.label}</option>)}
                            </select>
                            <input type="number" min={0} value={pago.amount || ''} onChange={(event) => actualizarPago(index, 'amount', event.target.value)} className="h-9 min-w-0 rounded-lg border border-pink-100 dark:border-white/10 bg-white dark:bg-zinc-900 px-2 text-xs font-bold text-right tabular-nums" placeholder="0" />
                            <button type="button" onClick={() => quitarPago(index)} className="w-7 h-7 grid place-items-center rounded-md text-gray-400 hover:text-red-500" aria-label="Quitar pago"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                    ))}
                    <div className="flex items-center justify-between gap-2">
                        <button type="button" onClick={() => setPaymentBreakdown([...(paymentBreakdown || []), { method: 'efectivo', amount: 0 }])} className="inline-flex items-center gap-1 text-[11px] font-bold text-pink-600 dark:text-pink-400"><Plus className="w-3 h-3" /> Agregar pago</button>
                        <span className={`text-[11px] font-bold whitespace-nowrap ${desgloseValido ? 'text-emerald-600' : 'text-amber-600'}`}>Suma ${sumaDesglose.toLocaleString()}</span>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between gap-4 mb-4 py-1">
                <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Total</span>
                <strong className="text-[clamp(1.25rem,3vw,1.5rem)] leading-none font-extrabold tracking-tight tabular-nums whitespace-nowrap shrink-0 text-gray-950 dark:text-white">${total.toLocaleString()}</strong>
            </div>

            <button type="button" onClick={onProcesar} disabled={disabled || cargando || !desgloseValido} className="w-full min-h-11 px-4 rounded-[14px] bg-gradient-to-br from-pink-500 to-pink-700 text-white text-sm font-bold shadow-[0_8px_18px_-6px_rgba(219,39,119,0.5)] disabled:opacity-45 disabled:shadow-none">
                {cargando ? <Loader variant="dots" size="sm" inline /> : cobrarDespues ? 'Registrar por cobrar' : 'Cobrar ahora'}
            </button>
            <button
                type="button"
                onClick={() => {
                    const siguiente = !cobrarDespues
                    setCobrarDespues(siguiente)
                    if (siguiente) setPaymentBreakdown(null)
                }}
                disabled={disabled || cargando}
                className={`w-full min-h-10 mt-1.5 px-4 rounded-[14px] border text-sm font-bold disabled:opacity-45 ${cobrarDespues
                    ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                    : 'border-pink-100/80 bg-white text-gray-700 dark:border-white/10 dark:bg-zinc-900 dark:text-gray-300'
                }`}
            >
                {cobrarDespues ? 'Cuenta por cobrar activada' : 'Cobrar después'}
            </button>

        </div>
    )
}
