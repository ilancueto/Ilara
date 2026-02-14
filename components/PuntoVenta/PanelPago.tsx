'use client'

import { Cliente } from '@/lib/supabase'
import { Banknote, CreditCard, Receipt, User, ArrowRight } from 'lucide-react'
import Loader from '../Loader'
import { PastelCard } from '@/components/ui/PastelCard'

interface PanelPagoProps {
    total: number
    cantidadItems: number
    metodoPago: 'efectivo' | 'tarjeta' | 'transferencia'
    setMetodoPago: (m: 'efectivo' | 'tarjeta' | 'transferencia') => void
    clientes: Cliente[]
    clienteSeleccionado: number | null
    setClienteSeleccionado: (id: number | null) => void
    notas: string
    setNotas: (notas: string) => void
    onProcesar: () => void
    cargando: boolean
    disabled: boolean
}

export default function PanelPago({
    total,
    cantidadItems,
    metodoPago,
    setMetodoPago,
    clientes,
    clienteSeleccionado,
    setClienteSeleccionado,
    notas,
    setNotas,
    onProcesar,
    cargando,
    disabled
}: PanelPagoProps) {
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
                    <label className="form-label flex items-center gap-2 text-gray-700">
                        <div className="p-1.5 bg-pink-100 rounded-lg text-pink-600">
                            <User className="w-3.5 h-3.5" />
                        </div>
                        Cliente (opcional)
                    </label>
                    <select
                        value={clienteSeleccionado || ''}
                        onChange={(e) => setClienteSeleccionado(e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full mt-2 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20 transition-all font-medium text-gray-800 cursor-pointer shadow-sm"
                    >
                        <option value="">Consumidor Final</option>
                        {clientes.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.first_name} {c.last_name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="form-label flex items-center gap-2 text-gray-700">
                        <span className="text-pink-500">Método de pago</span>
                    </label>
                    <div className="grid grid-cols-3 gap-3 mt-2">
                        {[
                            { id: 'efectivo', icon: Banknote, label: 'Efectivo' },
                            { id: 'tarjeta', icon: CreditCard, label: 'Tarjeta' },
                            { id: 'transferencia', icon: Receipt, label: 'Transf.' }
                        ].map(m => {
                            const Icon = m.icon
                            const isSelected = metodoPago === m.id
                            return (
                                <button
                                    key={m.id}
                                    onClick={() => setMetodoPago(m.id as any)}
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
                        disabled={disabled || cargando}
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
