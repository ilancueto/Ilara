'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, Venta, ItemVenta, Cliente } from '@/lib/supabase'
import { Calendar, DollarSign, Receipt, ChevronDown, CreditCard, Banknote, FileText, FileSpreadsheet, ShoppingBag, Pencil, Trash2, Printer, Clock, Scale, RotateCcw } from 'lucide-react'
import { panelHref } from '@/lib/appNavigation'
import { format, startOfDay, startOfWeek, startOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import ExportarReporte from './ExportarReporte'
import Loader from './Loader'
import FormularioEditarVenta from './FormularioEditarVenta'
import { deleteSale, getSaleReceiptViewUrl } from '@/lib/saleService'
import { imprimirComprobante } from '@/lib/comprobanteVenta'
import { PastelCard } from '@/components/ui/PastelCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/context/ToastContext'
import { BulkActionDialog, BulkSelectList } from '@/components/ui/BulkActionDialog'
import { listCatalogCollections } from '@/lib/domain/finance/browserFinance'
import { paymentMethodLabel, type PaymentMethodCode } from '@/lib/domain/payments/states'
import { formatPesoAR } from '@/lib/formatPesoAR'

export default function HistorialVentas({ onOpenFinance }: { onOpenFinance?: () => void } = {}) {
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
    const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null)
    const [catalogInflow, setCatalogInflow] = useState(0)
    const [catalogPays, setCatalogPays] = useState<Array<{
        order_number: string
        customer_name: string
        method: string
        amount_due: number
        approved_at: string | null
        status: string
    }>>([])

    const obtenerVentas = useCallback(async () => {
        setCargando(true)

        let query = supabase
            .from('sales')
            .select(
                'id, sale_date, total, payment_method, payment_breakdown, customer_name, customer_id, notes, status, created_at, receipt_url, created_by, updated_by'
            )
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
        const now = new Date()
        const to = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
        const fromDate =
            filtroFecha === 'hoy'
                ? startOfDay(now)
                : filtroFecha === 'semana'
                  ? startOfWeek(now)
                  : filtroFecha === 'mes'
                    ? startOfMonth(now)
                    : null
        const from = fromDate
            ? new Date(fromDate.getTime() - fromDate.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
            : '2016-01-01'
        void listCatalogCollections(from, to)
            .then((collections) => {
                setCatalogInflow(collections.total)
                setCatalogPays(collections.items)
            })
            .catch((error) => {
                console.warn('[historial] catalog collections', error)
                setCatalogInflow(0)
                setCatalogPays([])
            })
    }, [filtroFecha])

    useEffect(() => {
        const cargarClientes = async () => {
            const { data } = await supabase
                .from('customers')
                .select('id, first_name, last_name, email, phone, created_at')
                .order('first_name')
            if (data) setClientes(data)
        }
        cargarClientes()
    }, [])

    const obtenerItemsVenta = async (ventaId: number) => {
        const { data } = await supabase
            .from('sale_items')
            .select(
                'id, sale_id, product_id, combo_id, product_name, quantity, unit_price, subtotal, discount_percentage'
            )
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
            case 'efectivo': return <Banknote className="w-4 h-4 text-success" />
            case 'tarjeta': return <CreditCard className="w-4 h-4 text-blue-500" />
            case 'transferencia': return <FileText className="w-4 h-4 text-purple-500" />
            case 'credito': return <Clock className="w-4 h-4 text-warning" />
            case 'mixto': return <Receipt className="w-4 h-4 text-indigo-500" />
            default: return <Receipt className="w-4 h-4 text-hint" />
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

    const abrirComprobanteVenta = async (venta: Venta) => {
        const u = await getSaleReceiptViewUrl(venta)
        if (u) window.open(u, '_blank', 'noopener,noreferrer')
        else showError('No se pudo abrir el comprobante.')
    }

    const abrirComprobante = async (venta: Venta & { items?: ItemVenta[] }) => {
        let itemsList = venta.items
        if (!itemsList || itemsList.length === 0) {
            const { data } = await supabase
                .from('sale_items')
                .select(
                    'id, sale_id, product_id, combo_id, product_name, quantity, unit_price, subtotal, discount_percentage'
                )
                .eq('sale_id', venta.id)
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
            setBulkDeleteError('Seleccioná al menos una venta.')
            return
        }
        if (eliminando) return
        setBulkDeleteError(null)
        setEliminando(true)
        try {
            for (const id of ventasSeleccionadas) {
                await deleteSale(id)
            }
            setVentas(ventas.filter(v => !ventasSeleccionadas.has(v.id)))
            setVentasSeleccionadas(new Set())
            setMostrarEliminarModal(false)
            showSuccess('Ventas eliminadas. Stock actualizado.')
        } catch {
            const msg = 'No se pudieron eliminar algunas ventas. Podés reintentar.'
            setBulkDeleteError(msg)
            showError(msg)
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
        .reduce((sum, v) => sum + v.total, 0) + catalogInflow
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
        <div className="tab-content w-full space-y-10 animate-fade-in max-w-5xl sm:max-w-6xl lg:max-w-7xl xl:max-w-[90rem] 2xl:max-w-[100rem] mx-auto px-0 pt-6 sm:pt-8">
            {/* Stats: 1 col hasta lg (sidebar + media pantalla aplastaba 3 cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-historial-block">
                <PastelCard tone={2} className="p-5 sm:p-6 flex items-center gap-4 group min-w-0">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-full bg-surface flex items-center justify-center overflow-hidden">
                        <DollarSign size={26} className="text-success" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-wider text-hint font-bold mb-1">
                            Total Recaudado
                        </p>
                        <p className="text-xl sm:text-2xl lg:text-3xl font-black text-ink tracking-tight group-hover:text-success transition-all tabular-nums break-all">
                            ${totalRecaudado.toLocaleString()}
                        </p>
                    </div>
                </PastelCard>

                <PastelCard tone={1} className="p-5 sm:p-6 flex items-center gap-4 group min-w-0">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-full bg-surface flex items-center justify-center overflow-hidden">
                        <Clock size={26} className="text-warning" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-wider text-hint font-bold mb-1">
                            Total por Cobrar
                        </p>
                        <p className="text-xl sm:text-2xl lg:text-3xl font-black text-ink tracking-tight group-hover:text-warning transition-all tabular-nums break-all">
                            ${totalPorCobrar.toLocaleString()}
                        </p>
                    </div>
                </PastelCard>

                <PastelCard tone={3} className="p-5 sm:p-6 flex items-center gap-4 group min-w-0">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-full bg-surface flex items-center justify-center overflow-hidden">
                        <Receipt size={26} className="text-accent" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-wider text-hint font-bold mb-1">
                            Cantidad de Ventas
                        </p>
                        <p className="text-xl sm:text-2xl lg:text-3xl font-black text-ink tracking-tight group-hover:text-accent transition-all tabular-nums">
                            {cantidadVentas}
                        </p>
                    </div>
                </PastelCard>
            </div>

            <PastelCard className="p-5 sm:p-6 mb-historial-block" noHover data-testid="catalog-sales-strip">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-accent font-bold">Pedidos web cobrados</p>
                        <p className="text-2xl font-black text-ink tabular-nums">
                            ${formatPesoAR(catalogInflow)}
                        </p>
                        <p className="text-xs text-muted mt-1">
                            Mercado Pago y transferencias. No se mezclan con la caja del mostrador.
                        </p>
                    </div>
                    <a
                        href={panelHref({ tab: 'orders' })}
                        className="text-sm font-bold text-accent hover:underline"
                    >
                        Ver pedidos
                    </a>
                </div>
                {catalogPays.length > 0 && (
                    <ul className="mt-4 divide-y divide-gray-100 dark:divide-zinc-800">
                        {catalogPays.slice(0, 8).map((row) => (
                            <li key={`${row.order_number}-${row.approved_at || row.amount_due}`} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                                <span className="font-bold">
                                    {row.customer_name?.trim() || row.order_number}
                                    <span className="ml-2 font-medium text-hint">{row.order_number}</span>
                                </span>
                                <span className="text-muted">
                                    {paymentMethodLabel((row.method || 'mercado_pago') as PaymentMethodCode)}
                                </span>
                                <span className="font-black tabular-nums">${formatPesoAR(row.amount_due)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </PastelCard>

            {/* Filtros y Exportar */}
            <PastelCard className="p-6 sm:p-8 mb-historial-block" noHover>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 sm:gap-8">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-soft border border-line mr-2">
                            <Calendar className="w-4 h-4 text-accent" />
                            <span className="text-xs font-bold text-accent uppercase tracking-wide">Período</span>
                        </div>

                        {(['hoy', 'semana', 'mes', 'todo'] as const).map(filtro => (
                            <button
                                key={filtro}
                                onClick={() => setFiltroFecha(filtro)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${filtroFecha === filtro
                                    ? 'bg-pink-500 dark:bg-pink-600 text-white shadow-sm'
                                    : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-100 border border-line'
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
                                ? 'bg-amber-500 dark:bg-amber-600 text-white shadow-sm'
                                : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-100 border border-line'
                                }`}
                        >
                            <Clock className="w-3.5 h-3.5" />
                            Por cobrar
                        </button>
                    </div>

                    <button
                        onClick={() => setMostrarExportar(true)}
                        className="btn-ghost flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-4 py-2 hover:bg-success-soft hover:text-success hover:border-success-line transition-all text-muted border-line"
                        title="Exportar reporte a CSV"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Exportar CSV
                    </button>
                </div>
            </PastelCard>

            {/* Lista de ventas */}
            <div className="pb-10 pt-4 historial-list flex flex-col gap-8">
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
                        <PastelCard key={venta.id} className="!p-0 group overflow-hidden border-line" noHover>
                            {/* Header de la venta */}
                            <div className="relative w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left p-6 sm:p-7 hover:bg-canvas transition-colors">
                                {/* Botón que cubre la fila: expande el detalle sin anidar los botones de acciones. */}
                                <button
                                    type="button"
                                    onClick={() => alternarExpansion(venta.id)}
                                    aria-expanded={ventaExpandida === venta.id}
                                    aria-label={`Ver detalle de la venta #${venta.id}`}
                                    className="absolute inset-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                                />
                                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 pointer-events-none">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white dark:bg-gray-700 border border-line flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300 shadow-sm text-accent font-bold text-xs">
                                        #{venta.id}
                                    </div>

                                    <div className="flex-1 min-w-0 overflow-hidden">
                                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                            {venta.status === 'pending_payment' && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-warning-soft text-warning text-[10px] font-bold uppercase tracking-wider">
                                                    <Clock className="w-3 h-3" />
                                                    Por cobrar
                                                </span>
                                            )}
                                            {venta.customer_name ? (
                                                <span className="font-bold text-ink text-sm group-hover:text-accent transition-colors truncate">{venta.customer_name}</span>
                                            ) : (
                                                <span className="font-bold text-muted text-sm italic">Cliente Esporádico</span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                                            <span className="flex items-center gap-1 bg-canvas px-1.5 py-0.5 rounded-md border border-line">
                                                <Calendar className="w-3 h-3 text-hint flex-shrink-0" />
                                                {format(new Date(venta.created_at), "d MMM, HH:mm", { locale: es })}
                                            </span>
                                            <span className="flex items-center gap-1 bg-canvas px-1.5 py-0.5 rounded-md border border-line">
                                                {obtenerIconoPago(venta.payment_method)}
                                                {obtenerEtiquetaPago(venta.payment_method)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 border-t border-line pt-4 sm:border-0 sm:pt-0 pointer-events-none">
                                    <div className="text-left sm:text-right min-w-0">
                                        <p className="text-[10px] uppercase tracking-wider text-hint font-bold mb-1">Total</p>
                                        <p className="font-black text-xl sm:text-2xl text-success tabular-nums">${venta.total.toLocaleString()}</p>
                                    </div>
                                    <div className="relative flex items-center gap-2 sm:gap-4">
                                        <div aria-hidden className={`pointer-events-none w-8 h-8 rounded-full bg-canvas flex items-center justify-center transition-transform duration-300 border border-line flex-shrink-0 ${ventaExpandida === venta.id ? 'rotate-180 bg-primary-soft text-accent border-pink-200 dark:border-pink-700' : 'text-hint'}`}>
                                            <ChevronDown className="w-4 h-4" />
                                        </div>
                                        <div className="w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0 flex items-center justify-center sm:border-l border-line sm:pl-1">
                                            {venta.receipt_url ? (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        void abrirComprobanteVenta(venta)
                                                    }}
                                                    className="pointer-events-auto p-1.5 sm:p-2 rounded-xl text-accent hover:text-accent hover:bg-primary-soft border border-transparent hover:border-pink-100 dark:hover:border-pink-800 transition-colors shadow-sm"
                                                    title="Ver comprobante"
                                                    aria-label={`Ver comprobante de la venta #${venta.id}`}
                                                >
                                                    <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
                                                </button>
                                            ) : null}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setVentaEditando(venta); }}
                                            className="pointer-events-auto p-1.5 sm:p-2 rounded-xl text-hint hover:text-accent hover:bg-primary-soft border border-transparent hover:border-pink-100 dark:hover:border-pink-800 transition-colors flex-shrink-0"
                                            title="Editar venta"
                                            aria-label={`Editar venta #${venta.id}`}
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Detalles expandidos: bloque subordinado a la venta */}
                            {ventaExpandida === venta.id && (
                                <div className="border-t border-gray-200/80 dark:border-gray-600/80 bg-gray-50/70 dark:bg-gray-800/40 animate-slide-in-right">
                                    <div className="px-6 sm:px-8 lg:px-10 py-6 sm:py-7 flex flex-col gap-6">
                                        <p className="text-[11px] font-semibold text-hint uppercase tracking-wider flex items-center gap-2">
                                            <ShoppingBag className="w-3.5 h-3.5" />
                                            Detalle de compra
                                        </p>

                                        {venta.items ? (
                                            <div className="flex flex-col gap-3">
                                                {venta.items.map(item => (
                                                    <div
                                                        key={item.id}
                                                        className="flex items-center justify-between gap-4 py-3 px-0 border-b border-gray-100/80 dark:border-gray-700/80 last:border-0 last:pb-0"
                                                    >
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-semibold text-ink text-sm truncate">{item.product_name}</p>
                                                            <p className="text-xs text-muted mt-0.5">${item.unit_price.toLocaleString()} unitario</p>
                                                        </div>
                                                        <div className="flex items-center gap-4 flex-shrink-0 text-right">
                                                            <span className="text-xs font-medium text-muted tabular-nums">x{item.quantity}</span>
                                                            <span className="font-bold text-ink text-sm tabular-nums min-w-[4rem]">${item.subtotal.toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex justify-center py-6">
                                                <Loader text="Cargando detalles..." />
                                            </div>
                                        )}

                                        <div className="mt-2 pt-6 border-t border-gray-200/80 dark:border-gray-600/80 flex flex-wrap items-center justify-end gap-3">
                                            {venta.status === 'pending_payment' && (
                                                <button
                                                    type="button"
                                                    onClick={onOpenFinance}
                                                    disabled={!onOpenFinance}
                                                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-success-soft text-success hover:bg-success-soft border border-success-line font-bold text-sm transition-colors"
                                                >
                                                    <Scale className="w-4 h-4" />
                                                    Gestionar cobro
                                                </button>
                                            )}
                                            {venta.status !== 'cancelled' && (
                                                <a
                                                    href={panelHref({ tab: 'returns', channel: 'pos', saleId: venta.id })}
                                                    onClick={(event) => event.stopPropagation()}
                                                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-gray-700 text-primary-ink hover:bg-primary-soft border border-pink-200 dark:border-pink-800 font-semibold text-sm transition-colors shadow-sm"
                                                    data-testid={`venta-return-${venta.id}`}
                                                >
                                                    <RotateCcw className="w-4 h-4" />
                                                    Devolución
                                                </a>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => abrirComprobante(venta)}
                                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-gray-700 text-ink hover:bg-gray-100 dark:hover:bg-gray-600 border border-line font-semibold text-sm transition-colors shadow-sm"
                                            >
                                                <Printer className="w-4 h-4" />
                                                Imprimir comprobante
                                            </button>
                                            {venta.receipt_url && (
                                                <button
                                                    type="button"
                                                    onClick={() => void abrirComprobanteVenta(venta)}
                                                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-soft text-accent hover:bg-pink-100 dark:hover:bg-pink-900/60 border border-pink-100 dark:border-pink-800 font-semibold text-sm transition-colors"
                                                >
                                                    <Receipt className="w-4 h-4" />
                                                    Ver comprobante
                                                </button>
                                            )}
                                        </div>

                                        {venta.notes && (
                                            <div className="p-4 rounded-xl bg-warning-soft border border-warning-line flex gap-3">
                                                <FileText className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-[10px] text-warning uppercase tracking-wider font-bold mb-1">Notas adicionales</p>
                                                    <p className="text-sm text-amber-800 dark:text-amber-200/90 italic">{venta.notes}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </PastelCard>
                    ))
                )}
            </div>

            <div className="flex justify-end mt-10 pt-6 border-t border-line">
                <button
                    type="button"
                    onClick={() => {
                        setMostrarEliminarModal(true)
                        setVentasSeleccionadas(new Set())
                        setBulkDeleteError(null)
                    }}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-danger hover:text-danger hover:bg-danger-soft border border-danger-line hover:border-danger-line font-bold text-sm transition-colors"
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

            <BulkActionDialog
                open={mostrarEliminarModal}
                onClose={() => {
                    if (eliminando) return
                    setMostrarEliminarModal(false)
                    setBulkDeleteError(null)
                }}
                title="Eliminar ventas"
                description={`Seleccioná las ventas a eliminar (${ventasSeleccionadas.size} seleccionada(s)). El stock de los productos volverá a estar disponible.`}
                loading={eliminando}
                error={bulkDeleteError}
                testId="bulk-delete-ventas"
                footer={
                    <>
                        <button
                            type="button"
                            onClick={() => {
                                if (eliminando) return
                                setMostrarEliminarModal(false)
                                setBulkDeleteError(null)
                            }}
                            disabled={eliminando}
                            className="btn-ghost flex-1 sm:flex-none px-4 py-3 rounded-xl"
                            data-testid="bulk-delete-ventas-cancel"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleEliminarSeleccionadas()}
                            disabled={eliminando || ventasSeleccionadas.size === 0}
                            className="flex-1 sm:flex-none px-4 py-3 rounded-xl font-bold text-sm bg-danger-soft text-danger hover:bg-danger-soft border border-danger-line disabled:opacity-50 disabled:cursor-not-allowed"
                            data-testid="bulk-delete-ventas-confirm"
                        >
                            {eliminando
                                ? 'Eliminando…'
                                : `Eliminar ${ventasSeleccionadas.size} venta(s)`}
                        </button>
                    </>
                }
            >
                <BulkSelectList
                    testId="bulk-delete-ventas-list"
                    selectAllLabel="Seleccionar todas"
                    allSelected={
                        ventasFiltradas.length > 0 &&
                        ventasSeleccionadas.size === ventasFiltradas.length
                    }
                    onToggleAll={seleccionarTodas}
                    emptyMessage="No hay ventas en este período."
                    items={ventasFiltradas.map((venta) => ({
                        id: venta.id,
                        label: `#${venta.id} · ${venta.customer_name || 'Consumidor final'} · $${venta.total.toLocaleString()}`,
                        meta: format(new Date(venta.created_at), 'd MMM, HH:mm', { locale: es }),
                        selected: ventasSeleccionadas.has(venta.id),
                        onToggle: () => toggleSeleccionVenta(venta.id),
                    }))}
                />
            </BulkActionDialog>
        </div>
    )
}
