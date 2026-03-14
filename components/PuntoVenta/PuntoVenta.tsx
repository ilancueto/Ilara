'use client'

import { useState, useEffect } from 'react'
import { supabase, getUser, Producto, ItemCarrito, Cliente, ComboConItems } from '@/lib/supabase'
import { imprimirComprobante } from '@/lib/comprobanteVenta'
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

    const total = carrito.reduce((sum, item) => {
        const precio = item.producto ? item.producto.sale_price : (item.combo?.sale_price ?? 0)
        return sum + precio * item.cantidad
    }, 0)

    const manejarVenta = async () => {
        if (carrito.length === 0) return

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
            const user = await getUser()
            const payload: Record<string, unknown> = {
                sale_date: new Date().toISOString(),
                total,
                payment_method: cobrarDespues ? 'credito' : (tieneDesglose ? 'mixto' : metodoPago),
                customer_name: customerName || null,
                customer_id: nombreClienteOtro.trim() !== '' ? null : clienteSeleccionado,
                notes: notas || null,
                status: cobrarDespues ? 'pending_payment' : 'completed'
            }
            if (user?.id) payload.created_by = user.id
            if (tieneDesglose && paymentBreakdown) payload.payment_breakdown = paymentBreakdown

            const { data: venta, error: errorVenta } = await supabase
                .from('sales')
                .insert([payload])
                .select()
                .single()

            if (errorVenta) throw errorVenta

            // 2. Crear items de venta
            const itemsVenta: Array<{ sale_id: number; product_id: number | null; product_name: string; quantity: number; unit_price: number; subtotal: number; discount_percentage: number }> = []
            const movimientos: Array<{ product_id: number; type: string; quantity: number; reference_type: string; reference_id: number; notes: null }> = []

            for (const item of carrito) {
                if (item.producto) {
                    itemsVenta.push({
                        sale_id: venta.id,
                        product_id: item.producto.id,
                        product_name: item.producto.name,
                        quantity: item.cantidad,
                        unit_price: item.producto.sale_price,
                        subtotal: item.producto.sale_price * item.cantidad,
                        discount_percentage: 0
                    })
                    movimientos.push({ product_id: item.producto.id, type: 'sale', quantity: -item.cantidad, reference_type: 'sale', reference_id: venta.id, notes: null })
                } else if (item.combo) {
                    itemsVenta.push({
                        sale_id: venta.id,
                        product_id: null,
                        product_name: item.combo.name,
                        quantity: item.cantidad,
                        unit_price: item.combo.sale_price,
                        subtotal: item.combo.sale_price * item.cantidad,
                        discount_percentage: 0
                    })
                    for (const ci of item.combo.combo_items || []) {
                        const qty = ci.quantity * item.cantidad
                        movimientos.push({ product_id: ci.product_id, type: 'sale', quantity: -qty, reference_type: 'sale', reference_id: venta.id, notes: null })
                    }
                }
            }

            const { error: errorItems } = await supabase.from('sale_items').insert(itemsVenta)
            if (errorItems) throw errorItems

            // 3. Actualizar stock
            for (const item of carrito) {
                if (item.producto) {
                    const nuevoStock = item.producto.stock - item.cantidad
                    await supabase.from('products').update({ stock: nuevoStock }).eq('id', item.producto.id)
                } else if (item.combo) {
                    for (const ci of item.combo.combo_items || []) {
                        const prod = productos.find(p => p.id === ci.product_id)
                        if (prod) {
                            const nuevoStock = prod.stock - ci.quantity * item.cantidad
                            await supabase.from('products').update({ stock: nuevoStock }).eq('id', ci.product_id)
                        }
                    }
                }
            }

            // 4. Movimientos de stock
            const { error: errMov } = await supabase.from('stock_movements').insert(movimientos)
            if (errMov) {
                // Tabla stock_movements puede no existir aún; la venta ya se guardó
            }

            showSuccess(cobrarDespues ? 'Venta registrada como cuenta por cobrar' : '¡Venta completada! Stock actualizado')
            // Abrir comprobante para imprimir o guardar PDF y dar al cliente
            const itemsComprobante = itemsVenta.map(({ product_name, quantity, unit_price, subtotal }) => ({
              product_name,
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
        }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 max-w-[1400px] mx-auto">
            {/* Columna Izquierda: Catálogo + Carrito */}
            <div className="lg:col-span-2 flex flex-col gap-6 min-h-0">
                {/* Catálogo: ocupa espacio disponible y hace scroll si hace falta */}
                <div className="flex-1 min-h-0 flex flex-col">
                    <CatalogoPOS
                        productos={productos}
                        combos={combos}
                        onAddToCart={agregarAlCarrito}
                        onAddCombo={agregarComboAlCarrito}
                        comboDisponible={comboDisponible}
                    />
                </div>

                {/* Carrito: altura según contenido, no se superpone al catálogo */}
                <div className="flex-shrink-0">
                    <CarritoVenta
                        carrito={carrito}
                        onUpdateQuantity={actualizarCantidad}
                        onUpdateQuantityCombo={actualizarCantidadCombo}
                        onRemove={quitarDelCarrito}
                        onRemoveCombo={quitarComboDelCarrito}
                    />
                </div>
            </div>

            {/* Columna Derecha: Panel de Pago */}
            <div className="lg:col-span-1">
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
            </div>
        </div>
    )
}
