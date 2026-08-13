'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase, Producto, ItemCarrito, Cliente, ComboConItems, type PagoDesglose } from '@/lib/supabase'
import { imprimirComprobante } from '@/lib/comprobanteVenta'
import { totalCarritoPos } from '@/lib/posPricing'
import { useToast } from '@/context/ToastContext'
import { trackError, ObservabilityEvent } from '@/lib/observability'
import { createSaleWithItems } from '@/lib/domain/sales/browserSales'
import {
  ADMIN_COMBO_WITH_ITEMS_SELECT,
  ADMIN_POS_PRODUCT_SELECT,
} from '@/lib/domain/inventory/adminSelect'
import { CUSTOMER_LIST_SELECT } from '@/lib/domain/customers/browserCustomers'
import CatalogoPOS from './CatalogoPOS'
import CarritoVenta from './CarritoVenta'
import PanelPago from './PanelPago'

export default function PuntoVenta() {
    const { showSuccess, showError } = useToast()
    const [productos, setProductos] = useState<Producto[]>([])
    const [combos, setCombos] = useState<ComboConItems[]>([])
    const [clientes, setClientes] = useState<Cliente[]>([])

    // Carrito State
    const [carrito, setCarrito] = useState<ItemCarrito[]>([])

    // Sale State
    const [clienteSeleccionado, setClienteSeleccionado] = useState<number | null>(null)
    const [nombreClienteOtro, setNombreClienteOtro] = useState('')
    const [metodoPago, setMetodoPago] = useState<'efectivo' | 'tarjeta' | 'transferencia'>('efectivo')
    const [paymentBreakdown, setPaymentBreakdown] = useState<{ method: string; amount: number }[] | null>(null)
    const [cobrarDespues, setCobrarDespues] = useState(false)
    const [notas, setNotas] = useState('')
    const [cargando, setCargando] = useState(false)
    const procesandoVenta = useRef(false)

    useEffect(() => {
        obtenerProductos()
        obtenerCombos()
        obtenerClientes()
    }, [])

    const obtenerCombos = async () => {
        const { data } = await supabase
            .from('combos')
            .select(ADMIN_COMBO_WITH_ITEMS_SELECT)
            .eq('is_active', true)
        if (data) setCombos(data as unknown as ComboConItems[])
    }

    const obtenerProductos = async () => {
        const { data } = await supabase
            .from('products')
            .select(ADMIN_POS_PRODUCT_SELECT)
            .gt('stock', 0)
            .order('name')
        if (data) setProductos(data as unknown as Producto[])
    }

    const obtenerClientes = async () => {
        const { data } = await supabase
            .from('customers')
            .select(CUSTOMER_LIST_SELECT)
            .order('first_name')
        if (data) setClientes(data as Cliente[])
    }

    const agregarAlCarrito = (producto: Producto) => {
        const existente = carrito.find(item => item.producto?.id === producto.id)
        if (existente) {
            if (existente.cantidad < producto.stock) {
                setCarrito(carrito.map(item =>
                    item.producto?.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
                ))
            } else {
                showError(`Solo hay ${producto.stock} unidades disponibles`)
            }
        } else {
            setCarrito([...carrito, { producto, cantidad: 1 }])
        }
    }

    const comboDisponible = (combo: ComboConItems) => {
        const items = combo.combo_items || []
        const porId = new Map(productos.map(p => [p.id, p]))
        for (const ci of items) {
            const prod = porId.get(ci.product_id)
            if (!prod || prod.stock < ci.quantity) return false
        }
        return true
    }

    const agregarComboAlCarrito = (combo: ComboConItems) => {
        if (!comboDisponible(combo)) {
            showError('No hay stock suficiente para este combo')
            return
        }
        const existente = carrito.find(item => item.combo?.id === combo.id)
        if (existente) {
            const maxCombos = Math.min(...(combo.combo_items || []).map(ci => {
                const p = productos.find(pr => pr.id === ci.product_id)
                return p ? Math.floor(p.stock / ci.quantity) : 0
            }))
            if (existente.cantidad >= maxCombos) {
                showError(`Solo hay stock para ${maxCombos} combo(s)`)
                return
            }
            setCarrito(carrito.map(item => item.combo?.id === combo.id ? { ...item, cantidad: item.cantidad + 1 } : item))
        } else {
            setCarrito([...carrito, { combo, cantidad: 1 }])
        }
    }

    const actualizarCantidadCombo = (comboId: number, delta: number) => {
        const combo = combos.find(c => c.id === comboId)
        if (!combo) return
        const maxCombos = (combo.combo_items || []).length ? Math.min(...(combo.combo_items!.map(ci => {
            const p = productos.find(pr => pr.id === ci.product_id)
            return p ? Math.floor(p.stock / ci.quantity) : 0
        }))) : 1
        setCarrito(carrito.map(item => {
            if (item.combo?.id !== comboId) return item
            const nuevaCantidad = Math.max(1, Math.min(maxCombos, item.cantidad + delta))
            return { ...item, cantidad: nuevaCantidad }
        }))
    }

    const quitarComboDelCarrito = (comboId: number) => {
        setCarrito(carrito.filter(item => item.combo?.id !== comboId))
    }

    const actualizarCantidad = (productoId: number, delta: number) => {
        setCarrito(carrito.map(item => {
            if (item.producto?.id !== productoId) return item
            const nuevaCantidad = Math.max(1, Math.min(item.producto!.stock, item.cantidad + delta))
            return { ...item, cantidad: nuevaCantidad }
        }))
    }

    const quitarDelCarrito = (productoId: number) => {
        setCarrito(carrito.filter(item => item.producto?.id !== productoId))
    }

    // Preview UI alineado a RPC (round lista). Total autoritativo = respuesta DB.
    const total = totalCarritoPos(carrito)

    const manejarVenta = async () => {
        if (carrito.length === 0) return
        if (procesandoVenta.current) return
        procesandoVenta.current = true

        setCargando(true)
        try {
            const outcome = await createSaleWithItems({
                carrito,
                clienteSeleccionado,
                nombreClienteOtro,
                clientes,
                metodoPago,
                paymentBreakdown,
                cobrarDespues,
                notas,
            })

            if (!outcome.ok) {
                const err = outcome.error
                // Telemetría sin payload de venta ni PII (OBS-01).
                trackError(err, {
                    event:
                        err.code === 'stock'
                            ? ObservabilityEvent.STOCK_CONFLICT
                            : ObservabilityEvent.SALE_RPC_ERROR,
                    code: err.message?.slice(0, 64) || err.code,
                    route: 'pos',
                })
                showError(err.userMessage)
                return
            }

            const { sale: venta, lines: persistedLines } = outcome.result
            // Comprobante solo con líneas y precios devueltos por la DB (autoritativos).
            const itemsComprobante = persistedLines.map((ln) => ({
                product_name: ln.product_name,
                quantity: ln.quantity,
                unit_price: ln.unit_price,
                subtotal: ln.subtotal,
            }))

            const desglose =
                Array.isArray(venta.payment_breakdown) ? (venta.payment_breakdown as PagoDesglose[]) : null

            showSuccess(cobrarDespues ? 'Venta registrada como cuenta por cobrar' : '¡Venta completada! Stock actualizado')
            const abrio = imprimirComprobante(
                {
                    id: venta.id,
                    total: Number(venta.total),
                    customer_name: venta.customer_name ?? null,
                    payment_method: venta.payment_method ?? null,
                    payment_breakdown: desglose,
                    notes: venta.notes ?? null,
                    sale_date: venta.sale_date,
                    created_at: venta.created_at,
                },
                itemsComprobante
            )
            if (!abrio) {
                showError('Permití ventanas emergentes para imprimir el comprobante para el cliente.')
            }
            setCarrito([])
            setClienteSeleccionado(null)
            setNombreClienteOtro('')
            setCobrarDespues(false)
            setPaymentBreakdown(null)
            setNotas('')
            obtenerProductos()
            obtenerCombos()
        } catch (error) {
            console.error('Error al procesar venta:', error)
            showError('Error al procesar la venta')
        } finally {
            setCargando(false)
            procesandoVenta.current = false
        }
    }

    return (
        <div className="grid grid-cols-1 min-[900px]:grid-cols-[1.35fr_1fr] gap-4 max-w-[1200px] mx-auto items-stretch min-h-[min(70dvh,640px)]">
            {/* Catálogo de búsqueda */}
            <div className="min-w-0 min-h-0">
                <CatalogoPOS
                    productos={productos}
                    combos={combos}
                    onAddToCart={agregarAlCarrito}
                    onAddCombo={agregarComboAlCarrito}
                    comboDisponible={comboDisponible}
                />
            </div>

            {/* Columna carrito + cobro (stack estilo mock) */}
            <div className="min-w-0">
                <CarritoVenta
                    carrito={carrito}
                    onUpdateQuantity={actualizarCantidad}
                    onUpdateQuantityCombo={actualizarCantidadCombo}
                    onRemove={quitarDelCarrito}
                    onRemoveCombo={quitarComboDelCarrito}
                >
                    <PanelPago
                        total={total}
                        cantidadItems={carrito.reduce((acc, item) => acc + item.cantidad, 0)}
                        metodoPago={metodoPago}
                        setMetodoPago={setMetodoPago}
                        clientes={clientes}
                        clienteSeleccionado={clienteSeleccionado}
                        setClienteSeleccionado={setClienteSeleccionado}
                        nombreClienteOtro={nombreClienteOtro}
                        setNombreClienteOtro={setNombreClienteOtro}
                        notas={notas}
                        setNotas={setNotas}
                        paymentBreakdown={paymentBreakdown}
                        setPaymentBreakdown={setPaymentBreakdown}
                        cobrarDespues={cobrarDespues}
                        setCobrarDespues={setCobrarDespues}
                        onProcesar={manejarVenta}
                        cargando={cargando}
                        disabled={carrito.length === 0}
                    />
                </CarritoVenta>
            </div>
        </div>
    )
}
