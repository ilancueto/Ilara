'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase, Producto, ItemCarrito, Cliente, ComboConItems, type PagoDesglose } from '@/lib/supabase'
import { imprimirComprobante } from '@/lib/comprobanteVenta'
import { totalCarritoPos } from '@/lib/posPricing'
import { useToast } from '@/context/ToastContext'
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
            .select('*, combo_items(id, product_id, quantity, products(*))')
            .eq('is_active', true)
        if (data) setCombos(data as ComboConItems[])
    }

    const obtenerProductos = async () => {
        const { data } = await supabase
            .from('products')
            .select('*, categories(name)')
            .gt('stock', 0)
            .order('name')
        if (data) setProductos(data)
    }

    const obtenerClientes = async () => {
        const { data } = await supabase
            .from('customers')
            .select('*')
            .order('first_name')
        if (data) setClientes(data)
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
            // Get customer name: cliente de lista o "Otro (nombre)"
            let customerName = ''
            if (nombreClienteOtro.trim() !== '') {
                customerName = nombreClienteOtro.trim()
            } else if (clienteSeleccionado) {
                const cliente = clientes.find(c => c.id === clienteSeleccionado)
                if (cliente) customerName = `${cliente.first_name} ${cliente.last_name}`
            }

            // Con "cobrar después" no se envía desglose de pago (es cuenta por cobrar)
            const tieneDesglose = !cobrarDespues && paymentBreakdown && paymentBreakdown.length > 0
            // total/unit_price del cliente se envían solo como preview; el RPC los ignora (autoridad en DB).
            const salePayload: Record<string, unknown> = {
                sale_date: new Date().toISOString(),
                payment_method: cobrarDespues ? 'credito' : (tieneDesglose ? 'mixto' : metodoPago),
                customer_name: customerName || null,
                customer_id: nombreClienteOtro.trim() !== '' ? null : clienteSeleccionado,
                notes: notas || null,
                status: cobrarDespues ? 'pending_payment' : 'completed'
            }
            if (tieneDesglose && paymentBreakdown) salePayload.payment_breakdown = paymentBreakdown

            const lines: Array<Record<string, unknown>> = []
            for (const item of carrito) {
                if (item.producto) {
                    lines.push({
                        line_type: 'product',
                        product_id: item.producto.id,
                        quantity: item.cantidad,
                    })
                } else if (item.combo) {
                    lines.push({
                        line_type: 'combo',
                        combo_id: item.combo.id,
                        quantity: item.cantidad,
                    })
                }
            }

            const { data: rpcData, error: rpcError } = await supabase.rpc('create_sale_with_items', {
                p_payload: { sale: salePayload, lines },
            })

            if (rpcError) {
                const m = rpcError.message || ''
                if (m.includes('insufficient_stock')) {
                    showError('No hay stock suficiente para esta venta. Actualizá el catálogo e intentá de nuevo.')
                    return
                }
                if (m.includes('not_authenticated')) {
                    showError('Sesión expirada. Volvé a iniciar sesión.')
                    return
                }
                if (m.includes('not_authorized')) {
                    showError('No tenés permiso para registrar ventas.')
                    return
                }
                if (
                    m.includes('payment_mismatch') ||
                    m.includes('payment_breakdown_required') ||
                    m.includes('payment_breakdown_not_allowed')
                ) {
                    showError('El desglose de pago no coincide con el total. Revisá los montos.')
                    return
                }
                if (m.includes('invalid_payment') || m.includes('invalid_status')) {
                    showError('Método de pago o estado inválido. Revisá el cobro e intentá de nuevo.')
                    return
                }
                if (m.includes('invalid_catalog_price')) {
                    showError('Hay productos o combos sin precio válido. Revisá el inventario.')
                    return
                }
                if (m.includes('invalid_combo')) {
                    showError('Uno de los combos ya no es válido. Actualizá la página.')
                    return
                }
                if (m.includes('empty_combo')) {
                    showError('Uno de los combos no tiene productos configurados.')
                    return
                }
                if (m.includes('invalid_quantity')) {
                    showError('Cantidades inválidas en el carrito. Revisá las cantidades e intentá de nuevo.')
                    return
                }
                throw rpcError
            }

            const payload = rpcData as {
                sale?: Record<string, unknown>
                lines?: Array<Record<string, unknown>>
            } | null
            const venta = payload?.sale as
                | {
                      id: number
                      total: number
                      customer_name: string | null
                      payment_method: string | null
                      payment_breakdown?: unknown
                      notes: string | null
                      sale_date: string
                      created_at: string
                  }
                | undefined

            if (!venta?.id) {
                showError('La venta no se pudo registrar correctamente.')
                return
            }

            // Comprobante solo con líneas y precios devueltos por la DB.
            const persistedLines = Array.isArray(payload?.lines) ? payload!.lines! : []
            const itemsComprobante = persistedLines.map((ln) => ({
                product_name: String(ln.product_name ?? ''),
                quantity: Number(ln.quantity),
                unit_price: Number(ln.unit_price),
                subtotal: Number(ln.subtotal),
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
