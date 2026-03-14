'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase, getUser, Cliente, Venta, ItemVenta } from '@/lib/supabase'
import { Search, Plus, Edit2, Trash2, Users, ShoppingBag, Calendar, User, TrendingUp, Mail, Phone, Eye, Receipt, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { PastelCard } from '@/components/ui/PastelCard'
import { EmptyState } from '@/components/ui/EmptyState'

type ClienteStats = {
    totalVentas: number
    totalGastado: number
    ultimaCompra: string | null
}

export default function Clientes() {
    const { showSuccess, showError } = useToast()
    const [clientes, setClientes] = useState<Cliente[]>([])
    const [clientesStats, setClientesStats] = useState<Map<number, ClienteStats>>(new Map())
    const [cargando, setCargando] = useState(true)
    const [guardando, setGuardando] = useState(false)
    const [mostrarModal, setMostrarModal] = useState(false)
    const [editando, setEditando] = useState<Cliente | null>(null)
    const [terminoBusqueda, setTerminoBusqueda] = useState('')
    const [mostrarEliminarClientesModal, setMostrarEliminarClientesModal] = useState(false)
    const [clientesSeleccionados, setClientesSeleccionados] = useState<Set<number>>(new Set())
    const [eliminandoClientes, setEliminandoClientes] = useState(false)
    const [clientePerfil, setClientePerfil] = useState<Cliente | null>(null)
    const [ventasCliente, setVentasCliente] = useState<Pick<Venta, 'id' | 'sale_date' | 'total' | 'payment_method' | 'status' | 'created_at'>[]>([])
    const [cargandoPerfil, setCargandoPerfil] = useState(false)
    const [ventaExpandida, setVentaExpandida] = useState<number | null>(null)
    const [itemsPorVenta, setItemsPorVenta] = useState<Map<number, ItemVenta[]>>(new Map())

    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: ''
    })

    const obtenerClientes = useCallback(async () => {
        setCargando(true)
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .order('created_at', { ascending: false })

        if (!error && data) {
            setClientes(data)
            await obtenerStatsClientes(data)
        }
        setCargando(false)
    }, [])

    useEffect(() => {
        obtenerClientes()
    }, [obtenerClientes])

    const obtenerStatsClientes = async (clientes: Cliente[]) => {
        const statsMap = new Map<number, ClienteStats>()

        for (const cliente of clientes) {
            const { data: ventas } = await supabase
                .from('sales')
                .select('total, created_at')
                .eq('customer_id', cliente.id)

            if (ventas) {
                const totalVentas = ventas.length
                const totalGastado = ventas.reduce((sum, v) => sum + v.total, 0)
                const ultimaCompra = ventas.length > 0
                    ? format(new Date(ventas[0].created_at), 'dd MMM yyyy', { locale: es })
                    : null

                statsMap.set(cliente.id, { totalVentas, totalGastado, ultimaCompra })
            }
        }

        setClientesStats(statsMap)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.first_name.trim() || !formData.last_name.trim()) {
            showError('Nombre y apellido son obligatorios')
            return
        }

        setGuardando(true)

        if (editando) {
            // Actualizar
            const user = await getUser()
            const updatePayload: Record<string, unknown> = {
                first_name: formData.first_name.trim(),
                last_name: formData.last_name.trim(),
                email: formData.email.trim() || null,
                phone: formData.phone.trim() || null
            }
            if (user?.id) updatePayload.updated_by = user.id
            const { error } = await supabase
                .from('customers')
                .update(updatePayload)
                .eq('id', editando.id)

            if (!error) {
                showSuccess('Cliente actualizado correctamente')
                cerrarModal()
                obtenerClientes()
            } else {
                showError('Error al actualizar el cliente')
            }
        } else {
            // Crear
            const user = await getUser()
            const insertPayload: Record<string, unknown> = {
                first_name: formData.first_name.trim(),
                last_name: formData.last_name.trim(),
                email: formData.email.trim() || null,
                phone: formData.phone.trim() || null
            }
            if (user?.id) insertPayload.created_by = user.id
            const { error } = await supabase
                .from('customers')
                .insert([insertPayload])

            if (!error) {
                showSuccess('Cliente creado correctamente')
                cerrarModal()
                obtenerClientes()
            } else {
                showError('Error al crear el cliente')
            }
        }

        setGuardando(false)
    }

    const handleEditar = (cliente: Cliente) => {
        setEditando(cliente)
        setFormData({
            first_name: cliente.first_name,
            last_name: cliente.last_name,
            email: cliente.email ?? '',
            phone: cliente.phone ?? ''
        })
        setMostrarModal(true)
    }

    const handleEliminar = async (id: number) => {
        if (!confirm('¿Eliminar este cliente? Las ventas asociadas quedarán sin cliente.')) return

        const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', id)

        if (!error) {
            showSuccess('Cliente eliminado correctamente')
            obtenerClientes()
        } else {
            showError('Error al eliminar el cliente')
        }
    }

    const toggleSeleccionCliente = (id: number) => {
        setClientesSeleccionados(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const seleccionarTodosClientes = () => {
        if (clientesSeleccionados.size === clientes.length) {
            setClientesSeleccionados(new Set())
        } else {
            setClientesSeleccionados(new Set(clientes.map(c => c.id)))
        }
    }

    const handleEliminarClientesSeleccionados = async () => {
        if (clientesSeleccionados.size === 0) {
            showError('Seleccioná al menos un cliente.')
            return
        }
        if (!confirm(`¿Eliminar ${clientesSeleccionados.size} cliente(s)? Las ventas asociadas quedarán sin cliente.`)) return
        setEliminandoClientes(true)
        try {
            const ids = Array.from(clientesSeleccionados)
            const { error } = await supabase.from('customers').delete().in('id', ids)
            if (error) throw error
            setClientes(clientes.filter(c => !clientesSeleccionados.has(c.id)))
            setClientesSeleccionados(new Set())
            setMostrarEliminarClientesModal(false)
            showSuccess('Clientes eliminados correctamente.')
        } catch (err) {
            console.error('Error al eliminar clientes:', err)
            showError('Error al eliminar algunos clientes.')
        } finally {
            setEliminandoClientes(false)
        }
    }

    const cerrarModal = () => {
        setMostrarModal(false)
        setEditando(null)
        setFormData({ first_name: '', last_name: '', email: '', phone: '' })
    }

    const abrirPerfil = async (cliente: Cliente) => {
        setClientePerfil(cliente)
        setCargandoPerfil(true)
        setVentasCliente([])
        const { data } = await supabase
            .from('sales')
            .select('id, sale_date, total, payment_method, status, created_at')
            .eq('customer_id', cliente.id)
            .order('created_at', { ascending: false })
            .limit(15)
        if (data) setVentasCliente(data)
        setCargandoPerfil(false)
    }

    const cerrarPerfil = () => {
        setClientePerfil(null)
        setVentasCliente([])
        setVentaExpandida(null)
        setItemsPorVenta(new Map())
    }

    const toggleDetalleVenta = async (saleId: number) => {
        if (ventaExpandida === saleId) {
            setVentaExpandida(null)
            return
        }
        if (itemsPorVenta.has(saleId)) {
            setVentaExpandida(saleId)
            return
        }
        const { data } = await supabase
            .from('sale_items')
            .select('id, product_name, quantity, unit_price, subtotal')
            .eq('sale_id', saleId)
        if (data) {
            setItemsPorVenta(prev => new Map(prev).set(saleId, data as ItemVenta[]))
            setVentaExpandida(saleId)
        }
    }

    // Filtrar clientes
    const clientesFiltrados = clientes.filter(c => {
        const nombreCompleto = `${c.first_name} ${c.last_name}`.toLowerCase()
        return nombreCompleto.includes(terminoBusqueda.toLowerCase())
    })

    // Stats generales
    const clientesNuevos = clientes.filter(c => {
        const fecha = new Date(c.created_at)
        return fecha >= subDays(new Date(), 30)
    }).length

    const clientesActivos = Array.from(clientesStats.values()).filter(s => s.totalVentas > 0).length

    if (cargando) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <div className="text-center animate-pulse">
                    <div className="text-xl font-bold text-pink-400">
                        Cargando clientes...
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-fade-in pb-12 flex flex-col gap-10">
            {/* Header: buscador + botón centrados */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-4 sm:gap-5">
                <div className="relative w-full sm:w-auto sm:min-w-[280px] max-w-md h-12">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none shrink-0" aria-hidden />
                    <input
                        type="text"
                        placeholder="Buscar cliente..."
                        value={terminoBusqueda}
                        onChange={(e) => setTerminoBusqueda(e.target.value)}
                        className="absolute inset-0 w-full h-full pl-11 pr-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 focus:outline-none transition-all text-sm"
                    />
                </div>
                <button
                    onClick={() => { setEditando(null); setFormData({ first_name: '', last_name: '', email: '', phone: '' }); setMostrarModal(true); }}
                    className="btn-primary shrink-0 gap-2 px-5 py-3 rounded-xl shadow-lg shadow-pink-200 dark:shadow-pink-900/20 font-semibold"
                >
                    <Plus className="w-5 h-5" />
                    Nuevo Cliente
                </button>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
                <PastelCard className="p-5 sm:p-6 flex items-center gap-4 cursor-default rounded-2xl border border-gray-200 dark:border-gray-600">
                    <div className="w-12 h-12 rounded-xl bg-pink-50 dark:bg-pink-900/40 text-pink-500 dark:text-pink-400 flex items-center justify-center flex-shrink-0">
                        <Users className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-1">Total Clientes</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none tabular-nums">{clientes.length}</p>
                    </div>
                </PastelCard>
                <PastelCard className="p-5 sm:p-6 flex items-center gap-4 cursor-default rounded-2xl border border-gray-200 dark:border-gray-600">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 text-emerald-500 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-1">Nuevos (30 días)</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none tabular-nums">{clientesNuevos}</p>
                    </div>
                </PastelCard>
                <PastelCard className="p-5 sm:p-6 flex items-center gap-4 cursor-default rounded-2xl border border-gray-200 dark:border-gray-600">
                    <div className="w-12 h-12 rounded-xl bg-violet-50 dark:bg-violet-900/40 text-violet-500 dark:text-violet-400 flex items-center justify-center flex-shrink-0">
                        <ShoppingBag className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-1">Con Compras</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none tabular-nums">{clientesActivos}</p>
                    </div>
                </PastelCard>
            </div>

            {/* Resultados + Eliminar clientes */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Mostrando <span className="font-semibold text-gray-800 dark:text-gray-100 tabular-nums">{clientesFiltrados.length}</span> resultados
                </p>
                {clientes.length > 0 && (
                    <button
                        type="button"
                        onClick={() => { setMostrarEliminarClientesModal(true); setClientesSeleccionados(new Set()); }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors shrink-0"
                    >
                        <Trash2 className="w-4 h-4" />
                        Eliminar clientes
                    </button>
                )}
            </div>

            {/* Lista de clientes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {clientesFiltrados.map(cliente => {
                    const stats = clientesStats.get(cliente.id) || { totalVentas: 0, totalGastado: 0, ultimaCompra: null }

                    return (
                        <PastelCard key={cliente.id} className="group p-0 flex flex-col h-full hover:shadow-lg transition-all duration-200 border border-gray-200 dark:border-gray-600 rounded-2xl overflow-hidden">
                            <div className="p-6 sm:p-7 flex justify-between items-start gap-4">
                                <div className="flex items-start gap-4 min-w-0">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-100 to-white dark:from-pink-900/50 dark:to-gray-700 border border-pink-100 dark:border-gray-600 flex items-center justify-center text-pink-600 dark:text-pink-400 font-bold text-sm flex-shrink-0">
                                        {cliente.first_name.charAt(0)}{cliente.last_name.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base leading-snug group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors truncate">
                                            {cliente.first_name} {cliente.last_name}
                                        </h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 flex items-center gap-1.5">
                                            <Calendar className="w-3 h-3 flex-shrink-0" />
                                            {format(new Date(cliente.created_at), 'MMM yyyy', { locale: es })}
                                        </p>
                                        {(cliente.email || cliente.phone) && (
                                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                                {cliente.email && (
                                                    <span className="flex items-center gap-1.5 min-w-0 truncate">
                                                        <Mail className="w-3 h-3 flex-shrink-0" />
                                                        <span className="truncate">{cliente.email}</span>
                                                    </span>
                                                )}
                                                {cliente.phone && (
                                                    <span className="flex items-center gap-1.5">
                                                        <Phone className="w-3 h-3 flex-shrink-0" />
                                                        {cliente.phone}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                    <button type="button" onClick={() => abrirPerfil(cliente)} className="p-2 text-gray-400 dark:text-gray-500 hover:text-pink-600 dark:hover:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-900/40 rounded-lg transition-colors" title="Ver perfil">
                                        <Eye className="w-4 h-4" />
                                    </button>
                                    <button type="button" onClick={() => handleEditar(cliente)} className="p-2 text-gray-400 dark:text-gray-500 hover:text-pink-600 dark:hover:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-900/40 rounded-lg transition-colors" title="Editar">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button type="button" onClick={() => handleEliminar(cliente.id)} className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Eliminar">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="mt-auto border-t border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/50 px-6 py-5 grid grid-cols-3 gap-4">
                                <div className="text-center">
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-1">Compras</p>
                                    <p className="text-gray-800 dark:text-gray-100 font-bold tabular-nums">{stats.totalVentas}</p>
                                </div>
                                <div className="text-center border-x border-gray-100 dark:border-gray-700">
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-1">Total</p>
                                    <p className="text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">${stats.totalGastado.toLocaleString()}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-1">Última</p>
                                    <p className="text-gray-600 dark:text-gray-400 text-xs font-medium truncate">{stats.ultimaCompra || '—'}</p>
                                </div>
                            </div>
                        </PastelCard>
                    )
                })}
            </div>

            {/* Empty state */}
            {clientesFiltrados.length === 0 && (
                <EmptyState
                    icon={<Users className="w-10 h-10 text-pink-400" />}
                    title={terminoBusqueda ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                    description={terminoBusqueda ? 'Probá con otro término de búsqueda.' : 'Agregá tu primer cliente para empezar.'}
                    action={
                        !terminoBusqueda ? (
                            <button
                                onClick={() => {
                                    setEditando(null)
                                    setFormData({ first_name: '', last_name: '', email: '', phone: '' })
                                    setMostrarModal(true)
                                }}
                                className="btn-primary"
                            >
                                <Plus className="w-4 h-4" />
                                Nuevo cliente
                            </button>
                        ) : undefined
                    }
                />
            )}

            {/* Modal Eliminar clientes — portal fijo en viewport */}
            {mostrarEliminarClientesModal && typeof document !== 'undefined' && createPortal(
                <>
                    <div className="fixed inset-0 bg-black/55 dark:bg-black/65 z-[200]" onClick={() => !eliminandoClientes && setMostrarEliminarClientesModal(false)} aria-hidden />
                    <div className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none">
                        <div className="pointer-events-auto w-full max-w-lg max-h-[85vh] flex flex-col rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl overflow-hidden">
                            <div className="flex-shrink-0 p-6 border-b border-gray-100 dark:border-gray-700">
                                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Eliminar clientes</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Seleccioná los clientes a eliminar. Las ventas asociadas quedarán sin cliente.</p>
                            </div>
                            <div className="flex-1 min-h-0 overflow-y-auto p-4">
                                <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-pink-50/50 dark:hover:bg-gray-700/50 cursor-pointer mb-2">
                                    <input type="checkbox" checked={clientes.length > 0 && clientesSeleccionados.size === clientes.length} onChange={seleccionarTodosClientes} className="rounded border-pink-300 text-pink-600 focus:ring-pink-500" />
                                    <span className="font-bold text-sm text-gray-700 dark:text-gray-200">Seleccionar todos</span>
                                </label>
                                <div className="space-y-2">
                                    {clientes.length === 0 ? (
                                        <p className="text-gray-400 dark:text-gray-500 text-sm py-4">No hay clientes.</p>
                                    ) : (
                                        clientes.map(cliente => (
                                            <label key={cliente.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-pink-50/50 dark:hover:bg-gray-700/50 cursor-pointer border border-transparent hover:border-pink-100 dark:hover:border-gray-600">
                                                <input type="checkbox" checked={clientesSeleccionados.has(cliente.id)} onChange={() => toggleSeleccionCliente(cliente.id)} className="rounded border-pink-300 text-pink-600 focus:ring-pink-500" />
                                                <span className="flex-1 text-sm text-gray-800 dark:text-gray-100 truncate">{cliente.first_name} {cliente.last_name}</span>
                                                <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{format(new Date(cliente.created_at), 'MMM yyyy', { locale: es })}</span>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>
                            <div className="flex-shrink-0 p-6 border-t border-gray-100 dark:border-gray-700 flex gap-3 justify-end bg-gray-50/50 dark:bg-gray-800/80">
                                <button type="button" onClick={() => setMostrarEliminarClientesModal(false)} disabled={eliminandoClientes} className="btn-ghost">Cancelar</button>
                                <button type="button" onClick={handleEliminarClientesSeleccionados} disabled={eliminandoClientes || clientesSeleccionados.size === 0} className="px-4 py-2.5 rounded-xl font-bold text-sm bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800 disabled:opacity-50 disabled:cursor-not-allowed">
                                    {eliminandoClientes ? 'Eliminando...' : `Eliminar ${clientesSeleccionados.size} cliente(s)`}
                                </button>
                            </div>
                        </div>
                    </div>
                </>,
                document.body
            )}

            {/* Modal Nuevo / Editar Cliente */}
            {mostrarModal && typeof document !== 'undefined' && createPortal(
                <>
                    <div className="fixed inset-0 bg-black/50 dark:bg-black/60 z-[200] animate-fade-in" onClick={cerrarModal} aria-hidden />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md max-h-[90vh] flex flex-col z-[201] rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between flex-shrink-0 p-6 sm:p-8 pb-4">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
                                <div className="p-2.5 bg-pink-100 dark:bg-pink-900/40 rounded-xl text-pink-600 dark:text-pink-400">
                                    <User className="w-5 h-5" />
                                </div>
                                {editando ? 'Editar Cliente' : 'Nuevo Cliente'}
                            </h3>
                            <button type="button" onClick={cerrarModal} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" aria-label="Cerrar">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                            <div className="flex-1 overflow-y-auto px-6 sm:px-8 pb-6 flex flex-col gap-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="form-label text-sm">Nombre <span className="text-pink-500">*</span></label>
                                        <input type="text" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} placeholder="Ej: María" required className="form-input rounded-xl h-11 px-4" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="form-label text-sm">Apellido <span className="text-pink-500">*</span></label>
                                        <input type="text" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} placeholder="Ej: González" required className="form-input rounded-xl h-11 px-4" />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="form-label text-sm">Email</label>
                                    <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="cliente@ejemplo.com" className="form-input rounded-xl h-11 px-4" />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="form-label text-sm">Teléfono / WhatsApp</label>
                                    <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="Ej: 299 123 4567" className="form-input rounded-xl h-11 px-4" />
                                </div>
                            </div>
                            <div className="flex-shrink-0 p-6 sm:p-8 pt-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex gap-4">
                                <button type="button" onClick={cerrarModal} className="btn-ghost flex-1 py-3 rounded-xl">Cancelar</button>
                                <button type="submit" disabled={guardando} className="btn-primary flex-[2] py-3 rounded-xl shadow-lg shadow-pink-200 dark:shadow-pink-900/20 font-semibold">
                                    {guardando ? 'Guardando...' : (editando ? 'Guardar Cambios' : 'Crear Cliente')}
                                </button>
                            </div>
                        </form>
                    </div>
                </>,
                document.body
            )}

            {/* Modal Perfil de cliente */}
            {clientePerfil && typeof document !== 'undefined' && createPortal(
                <>
                    <div className="fixed inset-0 bg-black/50 dark:bg-black/60 z-[200]" onClick={cerrarPerfil} aria-hidden />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] flex flex-col z-[201] rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl overflow-hidden">
                        <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-4 flex-shrink-0">
                            <div className="flex items-center gap-4 min-w-0">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-100 to-white dark:from-pink-900/50 dark:to-gray-700 border border-pink-100 dark:border-gray-600 flex items-center justify-center text-pink-600 dark:text-pink-400 font-bold text-lg flex-shrink-0">
                                    {clientePerfil.first_name.charAt(0)}{clientePerfil.last_name.charAt(0)}
                                </div>
                                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 truncate">
                                    {clientePerfil.first_name} {clientePerfil.last_name}
                                </h3>
                            </div>
                            <button type="button" onClick={cerrarPerfil} className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 shrink-0" aria-label="Cerrar">
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
                            {(() => {
                                const stats = clientesStats.get(clientePerfil.id) || { totalVentas: 0, totalGastado: 0, ultimaCompra: null }
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
                            <div>
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
                                                    <button type="button" onClick={() => toggleDetalleVenta(v.id)} className="w-full flex items-center justify-between gap-4 py-3 px-4 hover:bg-gray-100/80 dark:hover:bg-gray-600/50 text-left transition-colors">
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
                            </div>
                        </div>
                        <div className="flex-shrink-0 p-6 sm:p-8 pt-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                            <button type="button" onClick={() => { cerrarPerfil(); handleEditar(clientePerfil); }} className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold shadow-lg shadow-pink-200 dark:shadow-pink-900/20">
                                <Edit2 className="w-4 h-4" />
                                Editar cliente
                            </button>
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    )
}
