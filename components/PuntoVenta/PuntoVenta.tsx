'use client'

import { useState, useEffect } from 'react'
import { supabase, getUser, Producto, ItemCarrito, Cliente } from '@/lib/supabase'
import { useToast } from '@/context/ToastContext'
import CatalogoPOS from './CatalogoPOS'
import CarritoVenta from './CarritoVenta'
import PanelPago from './PanelPago'

export default function PuntoVenta() {
    const { showSuccess, showError } = useToast()
    const [productos, setProductos] = useState<Producto[]>([])
    const [clientes, setClientes] = useState<Cliente[]>([])

    // Carrito State
    const [carrito, setCarrito] = useState<ItemCarrito[]>([])

    // Sale State
    const [clienteSeleccionado, setClienteSeleccionado] = useState<number | null>(null)
    const [metodoPago, setMetodoPago] = useState<'efectivo' | 'tarjeta' | 'transferencia'>('efectivo')
    const [paymentBreakdown, setPaymentBreakdown] = useState<{ method: string; amount: number }[] | null>(null)
    const [cobrarDespues, setCobrarDespues] = useState(false)
    const [notas, setNotas] = useState('')
    const [cargando, setCargando] = useState(false)

    useEffect(() => {
        obtenerProductos()
        obtenerClientes()
    }, [])

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
        const existente = carrito.find(item => item.producto.id === producto.id)
        if (existente) {
            if (existente.cantidad < producto.stock) {
                setCarrito(carrito.map(item =>
                    item.producto.id === producto.id
                        ? { ...item, cantidad: item.cantidad + 1 }
                        : item
                ))
            } else {
                showError(`Solo hay ${producto.stock} unidades disponibles`)
            }
        } else {
            setCarrito([...carrito, { producto, cantidad: 1 }])
        }
    }

    const actualizarCantidad = (productoId: number, delta: number) => {
        setCarrito(carrito.map(item => {
            if (item.producto.id === productoId) {
                const nuevaCantidad = Math.max(1, Math.min(item.producto.stock, item.cantidad + delta))
                return { ...item, cantidad: nuevaCantidad }
            }
            return item
        }))
    }

    const quitarDelCarrito = (productoId: number) => {
        setCarrito(carrito.filter(item => item.producto.id !== productoId))
    }

    const total = carrito.reduce((sum, item) => sum + (item.producto.sale_price * item.cantidad), 0)

    const manejarVenta = async () => {
        if (carrito.length === 0) return

        setCargando(true)
        try {
            // Get customer name if selected
            let customerName = ''
            if (clienteSeleccionado) {
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
                customer_id: clienteSeleccionado,
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

            // 2. Crear los items de venta
            const itemsVenta = carrito.map(item => ({
                sale_id: venta.id,
                product_id: item.producto.id,
                product_name: item.producto.name,
                quantity: item.cantidad,
                unit_price: item.producto.sale_price,
                subtotal: item.producto.sale_price * item.cantidad,
                discount_percentage: 0
            }))

            const { error: errorItems } = await supabase
                .from('sale_items')
                .insert(itemsVenta)

            if (errorItems) throw errorItems

            // 3. Actualizar stock de productos
            for (const item of carrito) {
                const nuevoStock = item.producto.stock - item.cantidad
                const { error: errorStock } = await supabase
                    .from('products')
                    .update({ stock: nuevoStock })
                    .eq('id', item.producto.id)

                if (errorStock) throw errorStock
            }

            // 4. Registrar movimientos de stock (historial) — opcional si existe la tabla
            const movimientos = carrito.map(item => ({
                product_id: item.producto.id,
                type: 'sale',
                quantity: -item.cantidad,
                reference_type: 'sale',
                reference_id: venta.id,
                notes: null
            }))
            const { error: errMov } = await supabase.from('stock_movements').insert(movimientos)
            if (errMov) {
                // Tabla stock_movements puede no existir aún; la venta ya se guardó
            }

            showSuccess(cobrarDespues ? 'Venta registrada como cuenta por cobrar' : '¡Venta completada! Stock actualizado')
            setCarrito([])
            setClienteSeleccionado(null)
            setCobrarDespues(false)
            setPaymentBreakdown(null)
            setNotas('')
            obtenerProductos() // Refrescar productos con nuevo stock
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
                        onAddToCart={agregarAlCarrito}
                    />
                </div>

                {/* Carrito: altura según contenido, no se superpone al catálogo */}
                <div className="flex-shrink-0">
                    <CarritoVenta
                        carrito={carrito}
                        onUpdateQuantity={actualizarCantidad}
                        onRemove={quitarDelCarrito}
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
