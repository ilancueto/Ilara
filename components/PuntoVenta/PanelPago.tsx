'use client'

import { useState } from 'react'
import { Cliente, PagoDesglose } from '@/lib/supabase'
import { Banknote, CreditCard, Receipt, User, ArrowRight, Clock, Plus, Trash2, SplitSquareVertical, Check } from 'lucide-react'
import Loader from '../Loader'
import { PastelCard } from '@/components/ui/PastelCard'

const METODOS: { id: 'efectivo' | 'tarjeta' | 'transferencia'; label: string; icon: typeof Banknote }[] = [
    { id: 'efectivo', label: 'Efectivo', icon: Banknote },
    { id: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
    { id: 'transferencia', label: 'Transf.', icon: Receipt }
]

const OTRO_CLIENTE = '__otro__'

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
    cantidadItems,
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
    disabled
}: PanelPagoProps) {
    const [dividirPago, setDividirPago] = useState(false)
    const [eligioOtro, setEligioOtro] = useState(false)
    const sumaDesglose = (paymentBreakdown || []).reduce((s, p) => s + p.amount, 0)
    const desgloseOk = dividirPago ? paymentBreakdown && paymentBreakdown.length > 0 && Math.abs(sumaDesglose - total) < 0.01 : true

    const agregarPago = () => {
        const actual = paymentBreakdown || []
        setPaymentBreakdown([...actual, { method: 'efectivo', amount: 0 }])
    }
    const quitarPago = (index: number) => {
        const actual = paymentBreakdown || []
        if (actual.length <= 1) {
            setPaymentBreakdown(null)
            setDividirPago(false)
        } else {
            setPaymentBreakdown(actual.filter((_, i) => i !== index))
        }
    }
    const actualizarPago = (index: number, field: 'method' | 'amount', value: string | number) => {
        const actual = [...(paymentBreakdown || [])]
        if (!actual[index]) return
        if (field === 'amount') actual[index].amount = typeof value === 'number' ? value : parseFloat(String(value)) || 0
        else actual[index].method = String(value)
        setPaymentBreakdown(actual)
    }
    return (
        <div className="sticky top-6">
            {/* Total Display */}
            <PastelCard className="bg-gradient-to-br from-pink-500 via-pink-600 to-rose-600 !border-0 shadow-xl shadow-pink-500/25 overflow-hidden panel-total" noHover>
                <div className="text-center py-5 px-4 relative text-white">
                    <p className="text-[11px] uppercase tracking-[0.2em] font-semibold mb-1">Total a pagar</p>
                    <p className="text-4xl md:text-5xl font-black mb-3 tracking-tight drop-shadow-sm">${total.toLocaleString()}</p>
                    <span className="inline-block px-3 py-1.5 bg-white/20 rounded-full text-xs font-semibold backdrop-blur-sm">
                        {cantidadItems} item{cantidadItems !== 1 ? 's' : ''}
                    </span>
                </div>
            </PastelCard>

            {/* Formulario */}
            <PastelCard className="space-y-6 p-6 mt-20px" noHover>
                <div>
                    <label className="form-label !flex items-center gap-2 text-gray-700 w-fit">
                        <div className="inline-flex items-center gap-2 px-3 py-2 bg-pink-100 rounded-xl text-pink-600">
                            <User className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="text-gray-700 font-medium text-sm uppercase tracking-wide">Cliente (opcional)</span>
                        </div>
                    </label>
                    <div className="mt-2 space-y-2.5">
                        <select
                            value={(eligioOtro || nombreClienteOtro.trim() !== '') ? OTRO_CLIENTE : (clienteSeleccionado ?? '')}
                            onChange={(e) => {
                                const v = e.target.value
                                if (v === OTRO_CLIENTE) {
                                    setClienteSeleccionado(null)
                                    setEligioOtro(true)
                                } else {
                                    setEligioOtro(false)
                                    setNombreClienteOtro('')
                                    setClienteSeleccionado(v ? parseInt(v, 10) : null)
                                }
                            }}
                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20 transition-all font-medium text-gray-800 cursor-pointer shadow-sm"
                        >
                            <option value="">Consumidor Final</option>
                            {clientes.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.first_name} {c.last_name}
                                </option>
                            ))}
                            <option value={OTRO_CLIENTE}>Otro (escribir nombre)</option>
                        </select>
                        {(eligioOtro || nombreClienteOtro.trim() !== '') && (
                            <input
                                type="text"
                                value={nombreClienteOtro}
                                onChange={(e) => {
                                    setNombreClienteOtro(e.target.value)
                                    if (e.target.value.trim() === '') setEligioOtro(false)
                                }}
                                placeholder="Nombre del cliente"
                                className="w-full mt-2 mb-2 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20 transition-all font-medium text-gray-800 placeholder-gray-400"
                            />
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    <p className="text-[11px] uppercase tracking-wider font-bold text-gray-400 mt-[10px] mb-[10px]">Opciones de pago</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setCobrarDespues(!cobrarDespues)}
                            className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-200 text-left ${
                                cobrarDespues
                                    ? 'bg-amber-50 border-amber-200 text-amber-800 shadow-sm ring-2 ring-amber-100'
                                    : 'bg-white border-gray-100 text-gray-500 hover:border-amber-100 hover:bg-amber-50/30 hover:text-gray-700'
                            }`}
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${cobrarDespues ? 'bg-amber-200/80 text-amber-700' : 'bg-gray-100 text-gray-400'}`}>
                                <Clock className="w-5 h-5" strokeWidth={2} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <span className="block text-sm font-bold">Cobrar después</span>
                                <span className="block text-[11px] text-gray-500 mt-0.5">Cuenta por cobrar</span>
                            </div>
                            {cobrarDespues && <Check className="w-5 h-5 text-amber-600 flex-shrink-0" strokeWidth={2.5} />}
                        </button>

                        <button
                            type="button"
                            disabled={cobrarDespues}
                            onClick={() => {
                                if (cobrarDespues) return
                                setDividirPago(!dividirPago)
                                if (!dividirPago) setPaymentBreakdown([{ method: 'efectivo', amount: 0 }])
                                else setPaymentBreakdown(null)
                            }}
                            className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-200 text-left ${
                                cobrarDespues
                                    ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-100 text-gray-400'
                                    : dividirPago
                                        ? 'bg-pink-50 border-pink-200 text-pink-800 shadow-sm ring-2 ring-pink-100'
                                        : 'bg-white border-gray-100 text-gray-500 hover:border-pink-100 hover:bg-pink-50/30 hover:text-gray-700'
                            }`}
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${dividirPago ? 'bg-pink-200/80 text-pink-700' : 'bg-gray-100 text-gray-400'}`}>
                                <SplitSquareVertical className="w-5 h-5" strokeWidth={2} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <span className="block text-sm font-bold">Dividir pago</span>
                                <span className="block text-[11px] text-gray-500 mt-0.5">Varios métodos</span>
                            </div>
                            {dividirPago && <Check className="w-5 h-5 text-pink-600 flex-shrink-0" strokeWidth={2.5} />}
                        </button>
                    </div>
                </div>

                {!cobrarDespues && (
                <>

                    {!dividirPago ? (
                        <div>
                            <label className="form-label flex items-center gap-2 text-gray-700 mt-[10px]">
                                <span className="text-pink-500">Método de pago</span>
                            </label>
                            <div className="grid grid-cols-3 gap-3 mt-2">
                                {METODOS.map(m => {
                                    const Icon = m.icon
                                    const isSelected = metodoPago === m.id
                                    return (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => setMetodoPago(m.id)}
                                            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 min-h-[72px] ${isSelected
                                                ? 'bg-pink-50 border-pink-300 text-pink-600 shadow-sm ring-2 ring-pink-200/60'
                                                : 'bg-gray-50/80 border-gray-200 text-gray-400 hover:border-pink-200 hover:bg-pink-50/50 hover:text-gray-600'
                                                }`}
                                        >
                                            <Icon className="w-5 h-5" strokeWidth={2} />
                                            <p className="text-xs font-bold">{m.label}</p>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label className="form-label text-gray-700">Desglose de pagos (suma = ${total.toLocaleString()})</label>
                            <div className="space-y-2 mt-2">
                                {(paymentBreakdown || []).map((pago, index) => (
                                    <div key={index} className="flex gap-2 items-center">
                                        <select
                                            value={pago.method}
                                            onChange={(e) => actualizarPago(index, 'method', e.target.value)}
                                            className="w-[140px] min-w-[140px] rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-800 bg-white focus:border-pink-300 focus:ring-1 focus:ring-pink-200"
                                        >
                                            {METODOS.map(m => (
                                                <option key={m.id} value={m.id}>{m.label}</option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            min={0}
                                            step={1}
                                            value={pago.amount || ''}
                                            onChange={(e) => actualizarPago(index, 'amount', e.target.value)}
                                            placeholder="0"
                                            className="w-[140px] min-w-[140px] rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold text-gray-800 text-right tabular-nums focus:border-pink-300 focus:ring-1 focus:ring-pink-200"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => quitarPago(index)}
                                            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0"
                                            title="Quitar"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={agregarPago}
                                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-gray-300 text-gray-500 hover:border-pink-300 hover:text-pink-600 hover:bg-pink-50/50 text-sm font-bold transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    Agregar pago
                                </button>
                            </div>
                            {paymentBreakdown && paymentBreakdown.length > 0 && (
                                <p className={`text-xs font-bold mt-2 ${Math.abs(sumaDesglose - total) < 0.01 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    Suma: ${sumaDesglose.toLocaleString()} {Math.abs(sumaDesglose - total) >= 0.01 && '(debe coincidir con el total)'}
                                </p>
                            )}
                        </div>
                    )}
                </>
                )}

                <div>
                    <label className="form-label text-gray-700">Notas (opcional)</label>
                    <textarea
                        rows={2}
                        placeholder="Detalles adicionales..."
                        value={notas}
                        onChange={(e) => setNotas(e.target.value)}
                        className="text-sm w-full mt-2 bg-white border border-gray-200 rounded-xl px-4 py-3 focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20 transition-all font-medium text-gray-800 placeholder-gray-400 shadow-sm resize-none"
                    />
                </div>

                <div className="pt-2">
                    <button
                        onClick={onProcesar}
                        disabled={disabled || cargando || !desgloseOk}
                        className="btn-primary w-full justify-center text-base py-4 font-bold tracking-wide shadow-lg shadow-pink-300/40 disabled:opacity-50 disabled:shadow-none hover:scale-[1.01] active:scale-[0.99] transition-transform"
                    >
                        {cargando ? (
                            <span className="flex items-center gap-2">
                                <Loader variant="dots" size="sm" inline />
                                Procesando...
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                Confirmar Venta
                                <ArrowRight className="w-5 h-5" />
                            </span>
                        )}
                    </button>
                </div>
            </PastelCard>
        </div>
    )
}
