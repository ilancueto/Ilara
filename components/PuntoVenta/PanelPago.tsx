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
        <div className="sticky top-6 flex flex-col gap-8">
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

            {/* Formulario — same spacing rhythm as Edit Sale modal */}
            <PastelCard className="dark:bg-gray-800/90 dark:border-gray-700 !p-0 overflow-hidden" noHover>
                <div className="form-body p-6 sm:p-8 border-gray-200 dark:border-gray-700">
                    {/* Cliente (opcional) */}
                    <section className="form-section">
                        <label htmlFor="confirmar-venta-cliente" className="form-label text-gray-700 dark:text-gray-300 flex items-center gap-2 w-fit">
                            <div className="inline-flex items-center gap-2 px-3 py-2 bg-pink-100 dark:bg-pink-900/40 rounded-xl text-pink-600 dark:text-pink-400">
                                <User className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="font-medium text-sm uppercase tracking-wide">Cliente (opcional)</span>
                            </div>
                        </label>
                        <div className="form-section-fields">
                            <select
                                id="confirmar-venta-cliente"
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
                                className="form-control-h w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm focus:border-pink-400 dark:focus:border-pink-500 focus:ring-2 focus:ring-pink-400/20 dark:focus:ring-pink-500/30 transition-all font-medium text-gray-800 dark:text-gray-100 cursor-pointer"
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
                                    className="form-control-h w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm focus:border-pink-400 dark:focus:border-pink-500 focus:ring-2 focus:ring-pink-400/20 transition-all font-medium text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                                />
                            )}
                        </div>
                    </section>

                    {/* Opciones de pago */}
                    <section className="form-section">
                        <p className="form-label text-gray-500 dark:text-gray-400">Opciones de pago</p>
                        <div className="form-section-fields grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setCobrarDespues(!cobrarDespues)}
                                className={`min-h-[72px] flex items-center gap-4 p-5 rounded-2xl border-2 transition-all duration-200 text-left ${
                                    cobrarDespues
                                        ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200 shadow-sm ring-2 ring-amber-100 dark:ring-amber-900/50'
                                        : 'bg-white dark:bg-gray-700/80 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-amber-300 dark:hover:border-amber-600 hover:bg-amber-50/30 dark:hover:bg-amber-900/20 hover:text-gray-700 dark:hover:text-gray-200'
                                }`}
                            >
                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${cobrarDespues ? 'bg-amber-200/80 dark:bg-amber-700/50 text-amber-700 dark:text-amber-300' : 'bg-gray-100 dark:bg-gray-600 text-gray-400 dark:text-gray-500'}`}>
                                    <Clock className="w-5 h-5" strokeWidth={2} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <span className="block text-sm font-bold">Cobrar después</span>
                                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">Cuenta por cobrar</span>
                                </div>
                                {cobrarDespues && <Check className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" strokeWidth={2.5} />}
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
                                className={`min-h-[72px] flex items-center gap-4 p-5 rounded-2xl border-2 transition-all duration-200 text-left ${
                                    cobrarDespues
                                        ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-500'
                                        : dividirPago
                                            ? 'bg-pink-50 dark:bg-pink-900/30 border-pink-200 dark:border-pink-700 text-pink-800 dark:text-pink-200 shadow-sm ring-2 ring-pink-100 dark:ring-pink-900/50'
                                            : 'bg-white dark:bg-gray-700/80 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-pink-300 dark:hover:border-pink-600 hover:bg-pink-50/30 dark:hover:bg-pink-900/20 hover:text-gray-700 dark:hover:text-gray-200'
                                }`}
                            >
                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${dividirPago ? 'bg-pink-200/80 dark:bg-pink-700/50 text-pink-700 dark:text-pink-300' : 'bg-gray-100 dark:bg-gray-600 text-gray-400 dark:text-gray-500'}`}>
                                    <SplitSquareVertical className="w-5 h-5" strokeWidth={2} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <span className="block text-sm font-bold">Dividir pago</span>
                                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">Varios métodos</span>
                                </div>
                                {dividirPago && <Check className="w-5 h-5 text-pink-600 dark:text-pink-400 flex-shrink-0" strokeWidth={2.5} />}
                            </button>
                        </div>
                    </section>

                    {!cobrarDespues && (
                        <>
                            {!dividirPago ? (
                                <section className="form-section">
                                    <label className="form-label text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                        <span className="text-pink-500 dark:text-pink-400">Método de pago</span>
                                    </label>
                                    <div className="form-payment-grid-3">
                                        {METODOS.map(m => {
                                            const Icon = m.icon
                                            const isSelected = metodoPago === m.id
                                            return (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => setMetodoPago(m.id)}
                                                    className={`form-payment-btn gap-2 px-4 rounded-xl border-2 transition-all text-sm font-bold ${
                                                        isSelected
                                                            ? 'bg-pink-50 dark:bg-pink-900/40 border-pink-300 dark:border-pink-600 text-pink-600 dark:text-pink-400 shadow-sm ring-2 ring-pink-200/60 dark:ring-pink-800/40'
                                                            : 'bg-gray-50 dark:bg-gray-700/80 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-pink-200 dark:hover:border-pink-600 hover:bg-pink-50/50 dark:hover:bg-pink-900/20 hover:text-gray-600 dark:hover:text-gray-200'
                                                    }`}
                                                >
                                                    <Icon className="w-5 h-5" strokeWidth={2} />
                                                    <p>{m.label}</p>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </section>
                            ) : (
                                <section className="form-section">
                                    <label className="form-label text-gray-700 dark:text-gray-300">Desglose de pagos (suma = ${total.toLocaleString()})</label>
                                    <div className="form-section-fields">
                                        {(paymentBreakdown || []).map((pago, index) => (
                                            <div key={index} className="flex gap-3 items-center">
                                                <select
                                                    value={pago.method}
                                                    onChange={(e) => actualizarPago(index, 'method', e.target.value)}
                                                    className="form-control-h w-[140px] min-w-[140px] rounded-xl border border-gray-200 dark:border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800 focus:border-pink-300 dark:focus:border-pink-500 focus:ring-1 focus:ring-pink-200 dark:focus:ring-pink-900/50"
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
                                                    className="form-control-h w-[140px] min-w-[140px] rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2.5 text-sm font-bold text-gray-800 dark:text-gray-100 text-right tabular-nums bg-white dark:bg-gray-800 focus:border-pink-300 dark:focus:border-pink-500 focus:ring-1 focus:ring-pink-200 dark:focus:ring-pink-900/50"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => quitarPago(index)}
                                                    className="p-2.5 rounded-xl text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex-shrink-0 transition-colors"
                                                    title="Quitar"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={agregarPago}
                                            className="form-control-h w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-pink-400 dark:hover:border-pink-500 hover:text-pink-600 dark:hover:text-pink-400 hover:bg-pink-50/50 dark:hover:bg-pink-900/20 text-sm font-bold transition-colors"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Agregar pago
                                        </button>
                                    </div>
                                    {paymentBreakdown && paymentBreakdown.length > 0 && (
                                        <p className={`text-xs font-bold mt-2 ${Math.abs(sumaDesglose - total) < 0.01 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                            Suma: ${sumaDesglose.toLocaleString()} {Math.abs(sumaDesglose - total) >= 0.01 && '(debe coincidir con el total)'}
                                        </p>
                                    )}
                                </section>
                            )}
                        </>
                    )}

                    {/* Notas (opcional) */}
                    <section className="form-section">
                        <label htmlFor="confirmar-venta-notas" className="form-label text-gray-700 dark:text-gray-300">Notas (opcional)</label>
                        <textarea
                            id="confirmar-venta-notas"
                            rows={3}
                            placeholder="Detalles adicionales..."
                            value={notas}
                            onChange={(e) => setNotas(e.target.value)}
                            className="form-textarea-min text-sm w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl focus:border-pink-400 dark:focus:border-pink-500 focus:ring-2 focus:ring-pink-400/20 dark:focus:ring-pink-500/30 transition-all font-medium text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none"
                        />
                    </section>

                    {/* Footer CTA */}
                    <div className="form-footer-bar border-gray-200 dark:border-gray-600">
                        <button
                            onClick={onProcesar}
                            disabled={disabled || cargando || !desgloseOk}
                            className="form-control-h btn-primary w-full justify-center text-base font-bold tracking-wide shadow-lg shadow-pink-300/40 dark:shadow-pink-900/40 disabled:opacity-50 disabled:shadow-none hover:scale-[1.01] active:scale-[0.99] transition-transform"
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
                </div>
            </PastelCard>
        </div>
    )
}
