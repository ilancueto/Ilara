'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2, UserRound } from 'lucide-react'
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
    clientes,
    clienteSeleccionado,
    setClienteSeleccionado,
    nombreClienteOtro,
    setNombreClienteOtro,
    notas,
    setNotas,
    cobrarDespues,
    setCobrarDespues,
    onProcesar,
    cargando,
    disabled,
}: PanelPagoProps) {
    const [busquedaClienta, setBusquedaClienta] = useState('')
    const clienta = clientes.find((c) => c.id === clienteSeleccionado) ?? null
    const coincidencias = useMemo(() => {
        const q = busquedaClienta.trim().toLowerCase()
        if (q.length < 2) return []
        return clientes
            .filter((c) => {
                const hay = `${c.first_name} ${c.last_name} ${c.phone ?? ''} ${c.email ?? ''}`.toLowerCase()
                return hay.includes(q)
            })
            .slice(0, 6)
    }, [busquedaClienta, clientes])
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
        <div className="px-[1.1rem] pt-3.5 pb-[1.1rem] border-t border-[#EDE8E1] dark:border-white/10 bg-[#FAF8F5] dark:bg-zinc-950/55">
            <div className="mb-3">
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
                    <UserRound className="w-3.5 h-3.5" aria-hidden />
                    Clienta
                </label>
                {clienta ? (
                    <div className="flex items-start justify-between gap-2 rounded-xl border border-pink-100 bg-white px-3 py-2 dark:border-white/10 dark:bg-zinc-900">
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 dark:text-gray-50 truncate">
                                {clienta.first_name} {clienta.last_name === '.' ? '' : clienta.last_name}
                            </p>
                            <p className="text-[11px] text-gray-500 truncate">
                                {[clienta.phone, clienta.email].filter(Boolean).join(' · ') || 'Sin teléfono'}
                            </p>
                        </div>
                        <button
                            type="button"
                            className="text-[11px] font-bold text-pink-600 shrink-0"
                            onClick={() => {
                                setClienteSeleccionado(null)
                                setBusquedaClienta('')
                            }}
                        >
                            Cambiar
                        </button>
                    </div>
                ) : (
                    <div className="relative">
                        <input
                            type="search"
                            value={busquedaClienta}
                            onChange={(event) => setBusquedaClienta(event.target.value)}
                            placeholder="Buscar por nombre o teléfono"
                            className="w-full h-9 rounded-lg border border-pink-100 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 text-xs font-semibold"
                            aria-label="Buscar clienta"
                        />
                        {coincidencias.length > 0 && (
                            <ul className="absolute z-10 mt-1 w-full rounded-xl border border-pink-100 bg-white shadow-lg dark:border-white/10 dark:bg-zinc-900 overflow-hidden">
                                {coincidencias.map((c) => (
                                    <li key={c.id}>
                                        <button
                                            type="button"
                                            className="w-full text-left px-3 py-2 text-xs hover:bg-pink-50 dark:hover:bg-pink-950/30"
                                            onClick={() => {
                                                setClienteSeleccionado(c.id)
                                                setNombreClienteOtro('')
                                                setBusquedaClienta('')
                                            }}
                                        >
                                            <span className="block font-bold truncate">
                                                {c.first_name} {c.last_name === '.' ? '' : c.last_name}
                                            </span>
                                            {c.phone ? <span className="text-gray-500">{c.phone}</span> : null}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <input
                            type="text"
                            value={nombreClienteOtro}
                            onChange={(event) => {
                                setNombreClienteOtro(event.target.value)
                                setClienteSeleccionado(null)
                            }}
                            placeholder="O anotar un nombre suelto"
                            className="w-full h-9 mt-1.5 rounded-lg border border-pink-100 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 text-xs font-semibold"
                            aria-label="Nombre de clienta esporádica"
                        />
                    </div>
                )}
                <textarea
                    value={notas}
                    onChange={(event) => setNotas(event.target.value)}
                    rows={2}
                    placeholder="Notas internas de la venta (opcional)"
                    className="w-full mt-1.5 rounded-lg border border-pink-100 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs"
                    aria-label="Notas de la venta"
                />
            </div>
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
                                    ? 'border-[#D97786] bg-[#FDF2F4] text-[#A04A5C] dark:border-[#E88B9A] dark:bg-[#2D1B22] dark:text-[#E88B9A]'
                                    : 'border-[#EDE8E1] bg-white text-gray-700 dark:border-white/10 dark:bg-zinc-900 dark:text-gray-300'
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
                            ? 'border-[#D97786] bg-[#FDF2F4] text-[#A04A5C] dark:border-[#E88B9A] dark:bg-[#2D1B22] dark:text-[#E88B9A]'
                            : 'border-[#EDE8E1] bg-white text-gray-700 dark:border-white/10 dark:bg-zinc-900 dark:text-gray-300'
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

            <button type="button" onClick={onProcesar} disabled={disabled || cargando || !desgloseValido} className="w-full min-h-11 px-4 rounded-[14px] bg-gradient-to-br from-[#CF6B7F] to-[#B85064] text-white text-sm font-bold shadow-[0_8px_18px_-6px_rgba(184,93,111,0.45)] disabled:opacity-45 disabled:shadow-none">
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
