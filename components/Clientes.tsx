'use client'

import { useState, useEffect } from 'react'
import { supabase, Cliente } from '@/lib/supabase'
import { Search, Plus, Edit2, Trash2, Users, ShoppingBag, Calendar, User, TrendingUp } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import Tooltip from './Tooltip'
import { PastelCard } from '@/components/ui/PastelCard'

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

    const [formData, setFormData] = useState({
        first_name: '',
        last_name: ''
    })

    useEffect(() => {
        obtenerClientes()
    }, [])

    const obtenerClientes = async () => {
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
    }

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
            const { error } = await supabase
                .from('customers')
                .update({
                    first_name: formData.first_name.trim(),
                    last_name: formData.last_name.trim()
                })
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
            const { error } = await supabase
                .from('customers')
                .insert([{
                    first_name: formData.first_name.trim(),
                    last_name: formData.last_name.trim()
                }])

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
            last_name: cliente.last_name
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
        setFormData({ first_name: '', last_name: '' })
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
        <div className="max-w-[1200px] mx-auto animate-fade-in pb-12 flex flex-col gap-12">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-6 justify-between items-center">
                <div className="relative w-full md:w-auto md:flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar cliente..."
                        value={terminoBusqueda}
                        onChange={(e) => setTerminoBusqueda(e.target.value)}
                        className="w-full pl-11 pr-5 py-3.5 bg-white border border-gray-200 rounded-2xl text-gray-800 placeholder-gray-400 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 shadow-sm transition-all"
                    />
                </div>

                <button
                    onClick={() => setMostrarModal(true)}
                    className="btn-primary w-full md:w-auto shadow-lg shadow-pink-200"
                >
                    <Plus className="w-5 h-5" />
                    Nuevo Cliente
                </button>
            </div>

            {/* Stats rápidas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
                <PastelCard className="p-8 flex items-center gap-6 group cursor-default min-h-[120px]">
                    <div className="w-14 h-14 rounded-2xl bg-pink-50 text-pink-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300 shadow-sm">
                        <Users className="w-7 h-7" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Total Clientes</p>
                        <p className="text-3xl font-extrabold text-gray-900 group-hover:text-pink-600 transition-colors leading-none">{clientes.length}</p>
                    </div>
                </PastelCard>

                <PastelCard className="p-8 flex items-center gap-6 group cursor-default min-h-[120px]">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300 shadow-sm">
                        <TrendingUp className="w-7 h-7" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Nuevos (30 días)</p>
                        <p className="text-3xl font-extrabold text-gray-900 group-hover:text-emerald-600 transition-colors leading-none">{clientesNuevos}</p>
                    </div>
                </PastelCard>

                <PastelCard className="p-8 flex items-center gap-6 group cursor-default min-h-[120px]">
                    <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300 shadow-sm">
                        <ShoppingBag className="w-7 h-7" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Con Compras</p>
                        <p className="text-3xl font-extrabold text-gray-900 group-hover:text-violet-600 transition-colors leading-none">{clientesActivos}</p>
                    </div>
                </PastelCard>
            </div>

            {/* Count + Eliminar clientes */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2 pl-1">
                <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-pink-400"></span>
                    <p className="text-sm text-gray-500 font-medium">
                        Mostrando <span className="text-gray-900 font-bold">{clientesFiltrados.length}</span> resultados
                    </p>
                </div>
                {clientes.length > 0 && (
                    <button
                        type="button"
                        onClick={() => { setMostrarEliminarClientesModal(true); setClientesSeleccionados(new Set()); }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 hover:border-red-300 font-bold text-sm transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                        Eliminar clientes
                    </button>
                )}
            </div>

            {/* Lista de clientes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
                {clientesFiltrados.map(cliente => {
                    const stats = clientesStats.get(cliente.id) || { totalVentas: 0, totalGastado: 0, ultimaCompra: null }

                    return (
                        <PastelCard key={cliente.id} className="group p-0 flex flex-col h-full hover:-translate-y-1 hover:shadow-xl transition-all duration-300 border-pink-100/50">
                            <div className="p-7 flex justify-between items-start gap-4">
                                <div className="flex items-start gap-5">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-100 to-white border border-pink-100 flex items-center justify-center text-pink-600 font-bold text-lg shadow-sm group-hover:scale-105 transition-transform">
                                        {cliente.first_name.charAt(0)}{cliente.last_name.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-800 text-lg leading-snug group-hover:text-pink-600 transition-colors">
                                            {cliente.first_name} {cliente.last_name}
                                        </h3>
                                        <p className="text-xs text-gray-400 mt-2 flex items-center gap-2 font-medium">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {format(new Date(cliente.created_at), 'MMM yyyy', { locale: es })}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                    <button
                                        onClick={() => handleEditar(cliente)}
                                        className="p-2 text-gray-400 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-colors"
                                        title="Editar"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleEliminar(cliente.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="mt-auto border-t border-gray-100 bg-gray-50/50 p-6 grid grid-cols-3 gap-4 rounded-b-[24px]">
                                <div className="text-center pl-4 border-r border-gray-200/60">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-2">Compras</p>
                                    <p className="text-gray-800 font-bold">{stats.totalVentas}</p>
                                </div>
                                <div className="text-center border-r border-gray-200/60">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-2">Total</p>
                                    <p className="text-emerald-600 font-bold">${stats.totalGastado.toLocaleString()}</p>
                                </div>
                                <div className="text-center pr-4">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-2">Última</p>
                                    <p className="text-gray-600 text-xs font-semibold truncate">
                                        {stats.ultimaCompra || '-'}
                                    </p>
                                </div>
                            </div>
                        </PastelCard>
                    )
                })}
            </div>

            {/* Empty state */}
            {clientesFiltrados.length === 0 && (
                <PastelCard className="flex flex-col items-center justify-center py-24 text-center border-dashed border-gray-300 bg-transparent shadow-none">
                    <div className="w-24 h-24 bg-pink-50 rounded-full flex items-center justify-center mb-6">
                        <Users className="w-10 h-10 text-pink-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">
                        {terminoBusqueda ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                    </h3>
                    <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                        {terminoBusqueda ? 'Intenta con otro término de búsqueda' : 'Comienza agregando tu primer cliente.'}
                    </p>
                    {!terminoBusqueda && (
                        <button
                            onClick={() => setMostrarModal(true)}
                            className="btn-primary"
                        >
                            <Plus className="w-4 h-4" />
                            Nuevo Cliente
                        </button>
                    )}
                </PastelCard>
            )}

            {/* Modal Eliminar clientes */}
            {mostrarEliminarClientesModal && (
                <>
                    <div className="modal-backdrop" onClick={() => !eliminandoClientes && setMostrarEliminarClientesModal(false)} />
                    <PastelCard className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col z-[100] !shadow-2xl" noHover>
                        <div className="p-6 border-b border-pink-100">
                            <h3 className="text-xl font-bold text-gray-800">Eliminar clientes</h3>
                            <p className="text-sm text-gray-500 mt-1">Seleccioná los clientes a eliminar. Las ventas asociadas quedarán sin cliente.</p>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1 min-h-0">
                            <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-pink-50/50 cursor-pointer mb-2">
                                <input
                                    type="checkbox"
                                    checked={clientes.length > 0 && clientesSeleccionados.size === clientes.length}
                                    onChange={seleccionarTodosClientes}
                                    className="rounded border-pink-300 text-pink-600 focus:ring-pink-500"
                                />
                                <span className="font-bold text-sm text-gray-700">Seleccionar todos</span>
                            </label>
                            <div className="space-y-2">
                                {clientes.length === 0 ? (
                                    <p className="text-gray-400 text-sm py-4">No hay clientes.</p>
                                ) : (
                                    clientes.map(cliente => (
                                        <label
                                            key={cliente.id}
                                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-pink-50/50 cursor-pointer border border-transparent hover:border-pink-100"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={clientesSeleccionados.has(cliente.id)}
                                                onChange={() => toggleSeleccionCliente(cliente.id)}
                                                className="rounded border-pink-300 text-pink-600 focus:ring-pink-500"
                                            />
                                            <span className="flex-1 text-sm text-gray-800 truncate">
                                                {cliente.first_name} {cliente.last_name}
                                            </span>
                                            <span className="text-xs text-gray-400 flex-shrink-0">
                                                {format(new Date(cliente.created_at), 'MMM yyyy', { locale: es })}
                                            </span>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>
                        <div className="p-6 border-t border-pink-100 flex gap-3 justify-end">
                            <button
                                type="button"
                                onClick={() => setMostrarEliminarClientesModal(false)}
                                disabled={eliminandoClientes}
                                className="btn-ghost"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleEliminarClientesSeleccionados}
                                disabled={eliminandoClientes || clientesSeleccionados.size === 0}
                                className="px-4 py-2.5 rounded-xl font-bold text-sm bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {eliminandoClientes ? 'Eliminando...' : `Eliminar ${clientesSeleccionados.size} cliente(s)`}
                            </button>
                        </div>
                    </PastelCard>
                </>
            )}

            {/* Modal de formulario */}
            {mostrarModal && (
                <>
                    <div className="modal-backdrop" onClick={cerrarModal} />
                    <PastelCard className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-9 z-[100] !shadow-2xl">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-2xl font-bold text-gray-800 tracking-tight flex items-center gap-3">
                                <div className="p-2 bg-pink-100 rounded-lg text-pink-600">
                                    <User className="w-6 h-6" />
                                </div>
                                {editando ? 'Editar Cliente' : 'Nuevo Cliente'}
                            </h3>
                            <button
                                onClick={cerrarModal}
                                className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Nombre <span className="text-pink-500">*</span></label>
                                    <input
                                        type="text"
                                        value={formData.first_name}
                                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                        placeholder="Ej: María"
                                        required
                                        className="transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="form-label">Apellido <span className="text-pink-500">*</span></label>
                                    <input
                                        type="text"
                                        value={formData.last_name}
                                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                        placeholder="Ej: González"
                                        required
                                        className="transition-all"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-gray-100 mt-4">
                                <button
                                    type="button"
                                    onClick={cerrarModal}
                                    className="btn-ghost flex-1 py-3 border-gray-200 text-gray-600 hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={guardando}
                                    className="btn-primary flex-[2] py-3 shadow-lg shadow-pink-200"
                                >
                                    {guardando ? 'Guardando...' : (editando ? 'Guardar Cambios' : 'Crear Cliente')}
                                </button>
                            </div>
                        </form>
                    </PastelCard>
                </>
            )}
        </div>
    )
}

function X({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
}
