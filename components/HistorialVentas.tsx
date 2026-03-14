'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, getUser, Venta, ItemVenta, Cliente } from '@/lib/supabase'
import { Calendar, DollarSign, Receipt, ChevronDown, CreditCard, Banknote, FileText, FileSpreadsheet, ShoppingBag, Pencil, Trash2, Printer, Clock, CheckCircle } from 'lucide-react'
import { format, startOfDay, startOfWeek, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import ExportarReporte from './ExportarReporte'
import Loader from './Loader'
import FormularioEditarVenta from './FormularioEditarVenta'
import { deleteSale } from '@/lib/saleService'
import { imprimirComprobante } from '@/lib/comprobanteVenta'
import { PastelCard } from '@/components/ui/PastelCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/context/ToastContext'

export default function HistorialVentas() {
    const { showSuccess, showError } = useToast()
    const [ventas, setVentas] = useState<(Venta & { items?: ItemVenta[] })[]>([])
    const [clientes, setClientes] = useState<Cliente[]>([])
    const [cargando, setCargando] = useState(true)
    const [ventaExpandida, setVentaExpandida] = useState<number | null>(null)
    const [filtroFecha, setFiltroFecha] = useState<'hoy' | 'semana' | 'mes' | 'todo'>('todo')
    const [filtroPorCobrar, setFiltroPorCobrar] = useState(false)
    const [mostrarExportar, setMostrarExportar] = useState(false)
    const [ventaEditando, setVentaEditando] = useState<Venta | null>(null)
    const [guardandoEditar, setGuardandoEditar] = useState(false)
    const [mostrarEliminarModal, setMostrarEliminarModal] = useState(false)
    const [ventasSeleccionadas, setVentasSeleccionadas] = useState<Set<number>>(new Set())
    const [eliminando, setEliminando] = useState(false)

    const obtenerVentas = useCallback(async () => {
        setCargando(true)

        let query = supabase
            .from('sales')
            .select('*')
            .order('created_at', { ascending: false })

        // Aplicar filtro de fecha
        const ahora = new Date()
        if (filtroFecha === 'hoy') {
            query = query.gte('created_at', startOfDay(ahora).toISOString())
        } else if (filtroFecha === 'semana') {
            query = query.gte('created_at', startOfWeek(ahora).toISOString())
        } else if (filtroFecha === 'mes') {
            query = query.gte('created_at', startOfMonth(ahora).toISOString())
        }

        const { data } = await query
        if (data) setVentas(data)
        setCargando(false)
    }, [filtroFecha])

    useEffect(() => {
        obtenerVentas()
    }, [obtenerVentas])

    useEffect(() => {
        const cargarClientes = async () => {
            const { data } = await supabase.from('customers').select('*').order('first_name')
            if (data) setClientes(data)
        }
        cargarClientes()
    }, [])

    const obtenerItemsVenta = async (ventaId: number) => {
        const { data } = await supabase
            .from('sale_items')
            .select('*')
            .eq('sale_id', ventaId)

        if (data) {
            setVentas(ventas.map(v => v.id === ventaId ? { ...v, items: data } : v))
        }
    }

    const alternarExpansion = (ventaId: number) => {
        if (ventaExpandida === ventaId) {
            setVentaExpandida(null)
        } else {
            setVentaExpandida(ventaId)
            const venta = ventas.find(v => v.id === ventaId)
            if (venta && !venta.items) {
                obtenerItemsVenta(ventaId)
            }
        }
    }

    const obtenerIconoPago = (metodo: string | null) => {
        switch (metodo) {
            case 'efectivo': return <Banknote className="w-4 h-4 text-emerald-500" />
            case 'tarjeta': return <CreditCard className="w-4 h-4 text-blue-500" />
            case 'transferencia': return <FileText className="w-4 h-4 text-purple-500" />
            case 'credito': return <Clock className="w-4 h-4 text-amber-500" />
            case 'mixto': return <Receipt className="w-4 h-4 text-indigo-500" />
            default: return <Receipt className="w-4 h-4 text-gray-400" />
        }
    }

    const obtenerEtiquetaPago = (metodo: string | null) => {
        switch (metodo) {
            case 'efectivo': return 'Efectivo'
            case 'tarjeta': return 'Tarjeta'
            case 'transferencia': return 'Transferencia'
            case 'credito': return 'A crédito'
            case 'mixto': return 'Varios'
            default: return 'N/A'
        }
    }

    const marcarComoCobrada = async (ventaId: number) => {
        const user = await getUser()
        const updatePayload: Record<string, unknown> = { status: 'completed' }
        if (user?.id) updatePayload.updated_by = user.id
        const { error } = await supabase
            .from('sales')
            .update(updatePayload)
            .eq('id', ventaId)
        if (error) {
            showError('Error al marcar como cobrada')
            return
        }
        showSuccess('Venta marcada como cobrada')
        if (filtroPorCobrar) {
            setVentas(ventas.filter(v => v.id !== ventaId))
        } else {
            setVentas(ventas.map(v => v.id === ventaId ? { ...v, status: 'completed' } : v))
        }
    }

    const abrirComprobante = async (venta: Venta & { items?: ItemVenta[] }) => {
        let itemsList = venta.items
        if (!itemsList || itemsList.length === 0) {
            const { data } = await supabase.from('sale_items').select('*').eq('sale_id', venta.id)
            itemsList = (data as ItemVenta[]) ?? []
        }
        const items = itemsList.map(({ product_name, quantity, unit_price, subtotal }) => ({
            product_name: product_name ?? '',
            quantity,
            unit_price,
            subtotal,
        }))
        const abrio = imprimirComprobante(
            {
                id: venta.id,
                total: venta.total,
                customer_name: venta.customer_name ?? null,
                payment_method: venta.payment_method ?? null,
                payment_breakdown: venta.payment_breakdown ?? null,
                notes: venta.notes ?? null,
                sale_date: venta.sale_date,
                created_at: venta.created_at,
            },
            items
        )
        if (!abrio) showError('Permití ventanas emergentes para imprimir.')
    }

    const toggleSeleccionVenta = (id: number) => {
        setVentasSeleccionadas(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const seleccionarTodas = () => {
        if (ventasSeleccionadas.size === ventasFiltradas.length) {
            setVentasSeleccionadas(new Set())
        } else {
            setVentasSeleccionadas(new Set(ventasFiltradas.map(v => v.id)))
        }
    }

    const handleEliminarSeleccionadas = async () => {
        if (ventasSeleccionadas.size === 0) {
            showError('Seleccioná al menos una venta.')
            return
        }
        if (!confirm(`¿Eliminar ${ventasSeleccionadas.size} venta(s)? Los productos volverán al stock.`)) return
        setEliminando(true)
        try {
            for (const id of ventasSeleccionadas) {
                await deleteSale(id)
            }
            setVentas(ventas.filter(v => !ventasSeleccionadas.has(v.id)))
            setVentasSeleccionadas(new Set())
            setMostrarEliminarModal(false)
            showSuccess('Ventas eliminadas. Stock actualizado.')
        } catch (err) {
            console.error('Error al eliminar ventas:', err)
            showError('No se pudieron eliminar algunas ventas.')
        } finally {
            setEliminando(false)
        }
    }

    // Lista filtrada (por "por cobrar" en UI)
    const ventasFiltradas = filtroPorCobrar
        ? ventas.filter(v => v.status === 'pending_payment')
        : ventas

    // Estadísticas: recaudado = cobrado, por cobrar = pendiente
    const totalRecaudado = ventas
        .filter(v => v.status !== 'pending_payment')
        .reduce((sum, v) => sum + v.total, 0)
    const totalPorCobrar = ventas
        .filter(v => v.status === 'pending_payment')
        .reduce((sum, v) => sum + v.total, 0)
    const cantidadVentas = ventasFiltradas.length

    if (cargando) {
        return (
            <div className="tab-content flex justify-center py-20">
                <Loader text="Cargando historial..." />
            </div>
        )
    }

    return (
        <div className="tab-content w-full space-y-8 animate-fade-in max-w-5xl sm:max-w-6xl lg:max-w-7xl xl:max-w-[90rem] 2xl:max-w-[100rem] mx-auto px-2 sm:px-4">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-historial-block">
                <PastelCard className="p-6 sm:p-7 flex items-center gap-5 group">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                        <DollarSign className="w-7 h-7 text-emerald-500" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">
                            Total Recaudado
                        </p>
                        <p className="text-3xl font-black text-gray-800 tracking-tight group-hover:text-emerald-600 transition-all">
                            ${totalRecaudado.toLocaleString()}
                        </p>
                    </div>
                </PastelCard>

                <PastelCard className="p-6 sm:p-7 flex items-center gap-5 group">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                        <Clock className="w-7 h-7 text-amber-500" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">
                            Total por Cobrar
                        </p>
                        <p className="text-3xl font-black text-gray-800 tracking-tight group-hover:text-amber-600 transition-all">
                            ${totalPorCobrar.toLocaleString()}
                        </p>
                    </div>
                </PastelCard>

                <PastelCard className="p-6 sm:p-7 flex items-center gap-5 group">
                    <div className="w-14 h-14 rounded-2xl bg-pink-50 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                        <Receipt className="w-7 h-7 text-pink-500" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">
                            Cantidad de Ventas
                        </p>
                        <p className="text-3xl font-black text-gray-800 tracking-tight group-hover:text-pink-600 transition-all">
                            {cantidadVentas}
                        </p>
                    </div>
                </PastelCard>
            </div>

            {/* Filtros y Exportar */}
            <PastelCard className="p-6 mb-historial-block" noHover>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-pink-50 border border-pink-100 mr-2">
                            <Calendar className="w-4 h-4 text-pink-500" />
                            <span className="text-xs font-bold text-pink-600 uppercase tracking-wide">Período</span>
                        </div>

                        {(['hoy', 'semana', 'mes', 'todo'] as const).map(filtro => (
                            <button
                                key={filtro}
                                onClick={() => setFiltroFecha(filtro)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${filtroFecha === filtro
                                    ? 'bg-pink-500 text-white shadow-sm'
                                    : 'bg-white hover:bg-gray-50 text-gray-400 hover:text-gray-600 border border-gray-100'
                                    }`}
                            >
                                {filtro === 'hoy' && 'Hoy'}
                                {filtro === 'semana' && 'Semana'}
                                {filtro === 'mes' && 'Mes'}
                                {filtro === 'todo' && 'Todo'}
                            </button>
                        ))}
                        <button
                            onClick={() => setFiltroPorCobrar(!filtroPorCobrar)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${filtroPorCobrar
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'bg-white hover:bg-gray-50 text-gray-400 hover:text-gray-600 border border-gray-100'
                                }`}
                        >
                            <Clock className="w-3.5 h-3.5" />
                            Por cobrar
                        </button>
                    </div>

                    <button
                        onClick={() => setMostrarExportar(true)}
                        className="btn-ghost flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-4 py-2 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all text-gray-500 border-gray-200"
                        title="Exportar reporte a CSV"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Exportar CSV
                    </button>
                </div>
            </PastelCard>

            {/* Lista de ventas */}
            <div className="pb-12 historial-list">
                {ventasFiltradas.length === 0 ? (
                    <div className="mb-historial-block">
                        <EmptyState
                            icon={<Receipt className="w-10 h-10 text-pink-400" />}
                            title="No hay ventas en este período"
                            description="Cuando registres ventas desde el punto de venta, aparecerán aquí."
                        />
                    </div>
                ) : (
                    ventasFiltradas.map(venta => (
                        <PastelCard key={venta.id} className="!p-0 group overflow-hidden border-pink-100/50 mb-historial-card" noHover>
                            {/* Header de la venta */}
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={() => alternarExpansion(venta.id)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternarExpansion(venta.id); } }}
                                className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left p-4 sm:p-6 hover:bg-pink-50/30 transition-colors cursor-pointer"
                            >
                                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white border border-pink-100 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300 shadow-sm text-pink-500 font-bold text-xs">
                                        #{venta.id}
                                    </div>

                                    <div className="flex-1 min-w-0 overflow-hidden">
                                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                            {venta.status === 'pending_payment' && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                                                    <Clock className="w-3 h-3" />
                                                    Por cobrar
                                                </span>
                                            )}
                                            {venta.customer_name ? (
                                                <span className="font-bold text-gray-800 text-sm group-hover:text-pink-600 transition-colors truncate">{venta.customer_name}</span>
                                            ) : (
                                                <span className="font-bold text-gray-400 text-sm italic">Cliente Esporádico</span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                            <span className="flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded-md border border-gray-100">
                                                <Calendar className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                                {format(new Date(venta.created_at), "d MMM, HH:mm", { locale: es })}
                                            </span>
                                            <span className="flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded-md border border-gray-100">
                                                {obtenerIconoPago(venta.payment_method)}
                                                {obtenerEtiquetaPago(venta.payment_method)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-2 flex-shrink-0 border-t border-pink-100/50 pt-3 sm:border-0 sm:pt-0">
                                    <div className="text-left sm:text-right min-w-0">
                                        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">Total</p>
                                        <p className="font-black text-lg sm:text-xl text-emerald-500 tabular-nums">${venta.total.toLocaleString()}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 sm:gap-3">
                                        <div className={`w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center transition-transform duration-300 border border-gray-100 flex-shrink-0 ${ventaExpandida === venta.id ? 'rotate-180 bg-pink-50 text-pink-500 border-pink-200' : 'text-gray-400'}`}>
                                            <ChevronDown className="w-4 h-4" />
                                        </div>
                                        <div className="w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0 flex items-center justify-center sm:border-l sm:border-gray-100 sm:pl-1">
                                            {venta.receipt_url ? (
                                                <a
                                                    href={venta.receipt_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="p-1.5 sm:p-2 rounded-xl text-pink-500 hover:text-pink-600 hover:bg-pink-50 border border-transparent hover:border-pink-100 transition-colors shadow-sm"
                                                    title="Ver comprobante"
                                                >
                                                    <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
                                                </a>
                                            ) : null}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setVentaEditando(venta); }}
                                            className="p-1.5 sm:p-2 rounded-xl text-gray-400 hover:text-pink-600 hover:bg-pink-50 border border-transparent hover:border-pink-100 transition-colors flex-shrink-0"
                                            title="Editar venta"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Detalles expandidos */}
                            {ventaExpandida === venta.id && (
                                <div className="border-t border-pink-100 bg-gray-50/50 p-6 sm:p-7 animate-slide-in-right">
                                    <div className="mb-4 px-1 flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                        <ShoppingBag className="w-3 h-3" />
                                        Detalle de compra
                                    </div>

                                    {venta.items ? (
                                        <div className="space-y-3">
                                            {venta.items.map(item => (
                                                <div key={item.id} className="flex items-center justify-between text-sm p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
                                                    <div className="flex-1">
                                                        <p className="font-semibold text-gray-800 mb-0.5">{item.product_name}</p>
                                                        <p className="text-xs text-gray-400 font-medium">
                                                            ${item.unit_price.toLocaleString()} unitario
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-xs font-bold bg-gray-100 px-2 py-1 rounded text-gray-500 mr-3">x{item.quantity}</span>
                                                        <span className="font-bold text-gray-800">${item.subtotal.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex justify-center py-4">
                                            <Loader text="Cargando detalles..." />
                                        </div>
                                    )}

                                    <div className="mt-4 flex flex-wrap gap-3">
                                        {venta.status === 'pending_payment' && (
                                            <button
                                                type="button"
                                                onClick={() => marcarComoCobrada(venta.id)}
                                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold text-sm transition-colors"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                                Marcar como cobrada
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => abrirComprobante(venta)}
                                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 font-bold text-sm transition-colors"
                                        >
                                            <Printer className="w-4 h-4" />
                                            Imprimir comprobante
                                        </button>
                                        {venta.receipt_url && (
                                            <a
                                                href={venta.receipt_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-pink-50 text-pink-600 hover:bg-pink-100 border border-pink-100 font-bold text-sm transition-colors"
                                            >
                                                <Receipt className="w-4 h-4" />
                                                Ver comprobante
                                            </a>
                                        )}
                                    </div>

                                    {venta.notes && (
                                        <div className="mt-5 p-4 rounded-xl bg-yellow-50 border border-yellow-100 flex gap-3">
                                            <div className="mt-0.5">
                                                <FileText className="w-4 h-4 text-yellow-500" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-yellow-600 uppercase tracking-wider font-bold mb-1">Notas Adicionales</p>
                                                <p className="text-sm text-yellow-800 italic">{venta.notes}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </PastelCard>
                    ))
                )}
            </div>

            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={() => { setMostrarEliminarModal(true); setVentasSeleccionadas(new Set()); }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 hover:border-red-300 font-bold text-sm transition-colors"
                >
                    <Trash2 className="w-4 h-4" />
                    Eliminar ventas
                </button>
            </div>

            <ExportarReporte
                mostrar={mostrarExportar}
                cerrar={() => setMostrarExportar(false)}
            />

            {ventaEditando && (
                <FormularioEditarVenta
                    venta={ventaEditando}
                    clientes={clientes}
                    onGuardar={(actualizada) => {
                        setVentas(ventas.map(v => v.id === actualizada.id ? { ...v, ...actualizada } : v))
                        setVentaEditando(null)
                        showSuccess('Venta actualizada')
                    }}
                    onCancelar={() => setVentaEditando(null)}
                    guardando={guardandoEditar}
                    setGuardando={setGuardandoEditar}
                />
            )}

            {mostrarEliminarModal && (
                <>
                    <div className="modal-backdrop" onClick={() => !eliminando && setMostrarEliminarModal(false)} />
                    <PastelCard className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col z-[100] !shadow-2xl" noHover>
                        <div className="p-6 border-b border-pink-100">
                            <h3 className="text-xl font-bold text-gray-800">Eliminar ventas</h3>
                            <p className="text-sm text-gray-500 mt-1">Seleccioná las ventas a eliminar. El stock de los productos volverá a estar disponible.</p>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1 min-h-0">
                            <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-pink-50/50 cursor-pointer mb-2">
                                <input
                                    type="checkbox"
                                    checked={ventasFiltradas.length > 0 && ventasSeleccionadas.size === ventasFiltradas.length}
                                    onChange={seleccionarTodas}
                                    className="rounded border-pink-300 text-pink-600 focus:ring-pink-500"
                                />
                                <span className="font-bold text-sm text-gray-700">Seleccionar todas</span>
                            </label>
                            <div className="space-y-2">
                                {ventasFiltradas.length === 0 ? (
                                    <p className="text-gray-400 text-sm py-4">No hay ventas en este período.</p>
                                ) : (
                                    ventasFiltradas.map(venta => (
                                        <label
                                            key={venta.id}
                                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-pink-50/50 cursor-pointer border border-transparent hover:border-pink-100"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={ventasSeleccionadas.has(venta.id)}
                                                onChange={() => toggleSeleccionVenta(venta.id)}
                                                className="rounded border-pink-300 text-pink-600 focus:ring-pink-500"
                                            />
                                            <span className="flex-1 text-sm text-gray-800">
                                                #{venta.id} · {venta.customer_name || 'Consumidor final'} · ${venta.total.toLocaleString()}
                                            </span>
                                            <span className="text-xs text-gray-400">
                                                {format(new Date(venta.created_at), 'd MMM, HH:mm', { locale: es })}
                                            </span>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>
                        <div className="p-6 border-t border-pink-100 flex gap-3 justify-end">
                            <button
                                type="button"
                                onClick={() => setMostrarEliminarModal(false)}
                                disabled={eliminando}
                                className="btn-ghost"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleEliminarSeleccionadas}
                                disabled={eliminando || ventasSeleccionadas.size === 0}
                                className="px-4 py-2.5 rounded-xl font-bold text-sm bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {eliminando ? 'Eliminando...' : `Eliminar ${ventasSeleccionadas.size} venta(s)`}
                            </button>
                        </div>
                    </PastelCard>
                </>
            )}
        </div>
    )
}
