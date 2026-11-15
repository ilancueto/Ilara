'use client'

import { useRef } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { Mail, Phone, Receipt, ChevronDown, ChevronUp, SquarePen, X } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import type { Cliente, ItemVenta, Venta } from '@/lib/supabase'

const CustomerCrmPanel = dynamic(() => import('@/components/CustomerCrmPanel'), {
    loading: () => <p className="text-sm text-gray-500 py-6">Cargando CRM...</p>,
})

export type ClienteStats = {
    totalVentas: number
    totalPedidos: number
    totalGastado: number
    ultimaCompra: string | null
}

export type VentaCliente = Pick<Venta, 'id' | 'total' | 'created_at' | 'sale_date' | 'payment_method' | 'status'>

type Props = {
    clientePerfil: Cliente
    isAdmin: boolean
    statsCliente: ClienteStats | undefined
    cargandoPerfil: boolean
    ventasCliente: VentaCliente[]
    ventaExpandida: number | null
    itemsPorVenta: Map<number, ItemVenta[]>
    onToggleVenta: (ventaId: number) => void
    onEditar: (cliente: Cliente) => void
    onClose: () => void
}

/** Perfil de cliente con contacto, métricas y últimas ventas (modal en portal). */
export default function ModalPerfilCliente({
    clientePerfil, isAdmin, statsCliente, cargandoPerfil, ventasCliente, ventaExpandida, itemsPorVenta, onToggleVenta, onEditar, onClose,
}: Props) {
    const refModalPerfil = useRef<HTMLDivElement>(null)
    useDialogA11y(true, onClose, refModalPerfil)
    if (typeof document === 'undefined') return null
    return createPortal(
            <>
                <div className="fixed inset-0 bg-black/50 dark:bg-black/60 z-[200]" onClick={onClose} aria-hidden />
                <div
                    ref={refModalPerfil}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="clientes-perfil-titulo"
                    className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] flex flex-col z-[201] rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl overflow-hidden outline-none"
                >
                    <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-4 flex-shrink-0">
                        <div className="flex items-center gap-4 min-w-0">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-100 to-white dark:from-pink-900/50 dark:to-gray-700 border border-pink-100 dark:border-gray-600 flex items-center justify-center text-pink-600 dark:text-pink-400 font-bold text-lg flex-shrink-0">
                                {clientePerfil.first_name.charAt(0)}{clientePerfil.last_name.charAt(0)}
                            </div>
                            <h3 id="clientes-perfil-titulo" className="text-xl font-bold text-gray-800 dark:text-gray-100 truncate">
                                {clientePerfil.first_name} {clientePerfil.last_name}
                            </h3>
                        </div>
                        <button type="button" onClick={onClose} className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 shrink-0" aria-label="Cerrar">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 sm:p-8 flex flex-col gap-8">
                        {(clientePerfil.email || clientePerfil.phone) && (
                            <div>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-3">Contacto</p>
                                <div className="flex flex-wrap gap-4 text-sm text-gray-700 dark:text-gray-300">
                                    {clientePerfil.email && (
                                        <span className="flex items-center gap-2">
                                            <Mail className="w-4 h-4 text-pink-500 dark:text-pink-400" />
                                            {clientePerfil.email}
                                        </span>
                                    )}
                                    {clientePerfil.phone && (
                                        <span className="flex items-center gap-2">
                                            <Phone className="w-4 h-4 text-pink-500 dark:text-pink-400" />
                                            {clientePerfil.phone}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                        {isAdmin && <CustomerCrmPanel customerId={clientePerfil.id} />}
                        {!isAdmin && (() => {
                            const stats = statsCliente || { totalVentas: 0, totalPedidos: 0, totalGastado: 0, ultimaCompra: null }
                            return (
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-5 rounded-xl bg-pink-50/60 dark:bg-pink-900/20 border border-pink-100 dark:border-pink-800/40 text-center">
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-2">Compras</p>
                                        <p className="text-xl font-bold text-gray-800 dark:text-gray-100 tabular-nums">{stats.totalVentas}</p>
                                    </div>
                                    <div className="p-5 rounded-xl bg-emerald-50/60 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/40 text-center">
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-2">Total gastado</p>
                                        <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">${stats.totalGastado.toLocaleString()}</p>
                                    </div>
                                    <div className="p-5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 text-center">
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-2">Última compra</p>
                                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{stats.ultimaCompra || '—'}</p>
                                    </div>
                                </div>
                            )
                        })()}
                        {!isAdmin && <div>
                            <div className="flex items-baseline gap-2 mb-4">
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold flex items-center gap-2">
                                    <Receipt className="w-4 h-4" />
                                    Últimas ventas
                                </p>
                                <span className="text-[11px] text-gray-400 dark:text-gray-500 font-normal normal-case">Click en una venta para ver productos</span>
                            </div>
                            {cargandoPerfil ? (
                                <p className="text-sm text-gray-400 dark:text-gray-500 py-6">Cargando...</p>
                            ) : ventasCliente.length === 0 ? (
                                <p className="text-sm text-gray-400 dark:text-gray-500 py-6">Sin ventas registradas.</p>
                            ) : (
                                <ul className="space-y-3">
                                    {ventasCliente.map(v => {
                                        const expandida = ventaExpandida === v.id
                                        const items = itemsPorVenta.get(v.id) ?? []
                                        return (
                                            <li key={v.id} className="rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 overflow-hidden">
                                                <button type="button" onClick={() => onToggleVenta(v.id)} className="w-full flex items-center justify-between gap-4 py-3 px-4 hover:bg-gray-100/80 dark:hover:bg-gray-600/50 text-left transition-colors">
                                                    <span className="text-sm text-gray-600 dark:text-gray-300">{format(new Date(v.sale_date || v.created_at), "d MMM yyyy, HH:mm", { locale: es })}</span>
                                                    <span className="flex items-center gap-2">
                                                        <span className="font-bold text-gray-800 dark:text-gray-100 tabular-nums">${v.total.toLocaleString()}</span>
                                                        {expandida ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                                    </span>
                                                </button>
                                                {expandida && (
                                                    <div className="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-600">
                                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-3">Productos</p>
                                                        <ul className="space-y-2.5">
                                                            {items.length === 0 ? (
                                                                <li className="text-xs text-gray-400 dark:text-gray-500 py-1">Cargando...</li>
                                                            ) : (
                                                                items.map(item => (
                                                                    <li key={item.id} className="flex justify-between items-baseline gap-4 text-sm">
                                                                        <span className="text-gray-700 dark:text-gray-300 min-w-0 truncate">{item.product_name} × {item.quantity}</span>
                                                                        <span className="font-medium text-gray-800 dark:text-gray-100 tabular-nums shrink-0">${item.subtotal.toLocaleString()}</span>
                                                                    </li>
                                                                ))
                                                            )}
                                                        </ul>
                                                    </div>
                                                )}
                                            </li>
                                        )
                                    })}
                                </ul>
                            )}
                        </div>}
                    </div>
                    <div className="flex-shrink-0 p-6 sm:p-8 pt-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                        <button type="button" onClick={() => { onClose(); onEditar(clientePerfil); }} className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold shadow-lg shadow-pink-200 dark:shadow-pink-900/20">
                            <SquarePen size={16} aria-hidden />
                            Editar cliente
                        </button>
                    </div>
                </div>
            </>,
        document.body
    )
}
