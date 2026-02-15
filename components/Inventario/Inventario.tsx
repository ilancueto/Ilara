'use client'

import { useState, useEffect } from 'react'
import { supabase, Producto, Categoria } from '@/lib/supabase'
import { Settings, Search, Plus, Trash2, Tag } from 'lucide-react'
import GestionCategorias from '../GestionCategorias'
import GestionCupones from '../GestionCupones'
import { useToast } from '@/context/ToastContext'
import { PastelCard } from '@/components/ui/PastelCard'
import TablaInventario from './TablaInventario'
import FormularioProducto from './FormularioProducto'

import DetalleProducto from './DetalleProducto'

export default function Inventario() {
    const { showSuccess, showError } = useToast()
    const [productos, setProductos] = useState<Producto[]>([])
    const [categorias, setCategorias] = useState<Categoria[]>([])
    const [cargando, setCargando] = useState(true)

    // Modal states
    const [modalAbierto, setModalAbierto] = useState(false)
    const [detalleAbierto, setDetalleAbierto] = useState(false)
    const [gestionCatsAbierto, setGestionCatsAbierto] = useState(false)
    const [gestionCuponesAbierto, setGestionCuponesAbierto] = useState(false)
    const [productoEditar, setProductoEditar] = useState<Producto | null>(null)
    const [productoVer, setProductoVer] = useState<Producto | null>(null)

    // Filter states
    const [terminoBusqueda, setTerminoBusqueda] = useState('')
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('all')

    // Eliminar productos (modal como historial de ventas)
    const [mostrarEliminarProductosModal, setMostrarEliminarProductosModal] = useState(false)
    const [productosSeleccionados, setProductosSeleccionados] = useState<Set<number>>(new Set())
    const [eliminandoProductos, setEliminandoProductos] = useState(false)

    useEffect(() => {
        obtenerData()
    }, [])

    const obtenerData = async () => {
        setCargando(true)
        await Promise.all([obtenerProductos(), obtenerCategorias()])
        setCargando(false)
    }

    const obtenerProductos = async () => {
        const { data, error } = await supabase
            .from('products')
            .select('*, categories(name)')
            .order('created_at', { ascending: false })
        if (!error && data) setProductos(data)
    }

    const obtenerCategorias = async () => {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('name')
        if (!error && data) setCategorias(data)
    }

    const handleEliminar = async (id: number) => {
        if (confirm('¿Estás seguro de eliminar este producto?')) {
            const { error } = await supabase.from('products').delete().eq('id', id)
            if (!error) {
                showSuccess('Producto eliminado correctamente')
                obtenerProductos()
            } else {
                showError('Error al eliminar el producto')
            }
        }
    }

    const toggleSeleccionProducto = (id: number) => {
        setProductosSeleccionados(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const seleccionarTodosProductos = () => {
        if (productosSeleccionados.size === productosFiltrados.length) {
            setProductosSeleccionados(new Set())
        } else {
            setProductosSeleccionados(new Set(productosFiltrados.map(p => p.id)))
        }
    }

    const handleEliminarProductosSeleccionados = async () => {
        if (productosSeleccionados.size === 0) {
            showError('Seleccioná al menos un producto.')
            return
        }
        if (!confirm(`¿Eliminar ${productosSeleccionados.size} producto(s)? Los que tengan ventas asociadas no se eliminarán.`)) return
        setEliminandoProductos(true)
        try {
            const ids = Array.from(productosSeleccionados)
            let eliminados = 0
            const noEliminados: number[] = []
            const eliminadosIds = new Set<number>()
            for (const id of ids) {
                const { error } = await supabase.from('products').delete().eq('id', id)
                if (error) {
                    if (error.message?.includes('foreign key') || error.message?.includes('violates'))
                        noEliminados.push(id)
                    else
                        throw error
                } else {
                    eliminados++
                    eliminadosIds.add(id)
                }
            }
            setProductos(productos.filter(p => !eliminadosIds.has(p.id)))
            setProductosSeleccionados(new Set())
            setMostrarEliminarProductosModal(false)
            if (noEliminados.length === 0)
                showSuccess('Productos eliminados correctamente.')
            else if (eliminados > 0)
                showSuccess(`${eliminados} eliminado(s). ${noEliminados.length} no se pudieron eliminar (tienen ventas asociadas).`)
            else
                showError('Ninguno se pudo eliminar: todos tienen ventas asociadas.')
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Error desconocido'
            console.error('Error al eliminar productos:', msg, err)
            showError(msg || 'No se pudieron eliminar algunos productos.')
        } finally {
            setEliminandoProductos(false)
        }
    }

    // Filtrado
    const productosFiltrados = productos.filter(producto => {
        const coincideBusqueda =
            producto.name.toLowerCase().includes(terminoBusqueda.toLowerCase()) ||
            producto.brand?.toLowerCase().includes(terminoBusqueda.toLowerCase())
        const coincideCategoria =
            categoriaSeleccionada === 'all' ||
            producto.category_id?.toString() === categoriaSeleccionada
        return coincideBusqueda && coincideCategoria
    })

    return (
        <div className="max-w-7xl mx-auto flex flex-col gap-12">
            {/* Header Toolbar - Updated for Pastel UI */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white p-7 rounded-[24px] border border-pink-100 shadow-sm">
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full sm:flex-1 sm:min-w-[250px]">
                        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o marca..."
                            value={terminoBusqueda}
                            onChange={(e) => setTerminoBusqueda(e.target.value)}
                            className="w-full bg-gray-50 border-transparent focus:bg-white border focus:border-pink-200 rounded-xl py-3 pl-5 pr-11 text-sm transition-all outline-none"
                        />
                    </div>

                    <select
                        value={categoriaSeleccionada}
                        onChange={(e) => setCategoriaSeleccionada(e.target.value)}
                        className="w-full sm:w-auto bg-gray-50 border-transparent focus:bg-white border focus:border-pink-200 rounded-xl py-3 px-4 text-sm transition-all outline-none cursor-pointer hover:bg-gray-100"
                    >
                        <option value="all">Todas las categorías</option>
                        {categorias.map(cat => (
                            <option key={cat.id} value={cat.id.toString()}>{cat.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                        onClick={() => setGestionCatsAbierto(true)}
                        className="btn-ghost flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 text-gray-600 hover:bg-gray-100 border-0"
                        title="Administrar categorías"
                    >
                        <Settings className="w-4 h-4" />
                        <span className="hidden sm:inline">Categorías</span>
                    </button>
                    <button
                        onClick={() => setGestionCuponesAbierto(true)}
                        className="btn-ghost flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 text-gray-600 hover:bg-gray-100 border-0"
                        title="Cupones del catálogo"
                    >
                        <Tag className="w-4 h-4" />
                        <span className="hidden sm:inline">Cupones</span>
                    </button>

                    <button
                        onClick={() => {
                            setProductoEditar(null)
                            setModalAbierto(true)
                        }}
                        className="btn-primary flex items-center justify-center gap-2 px-6 py-2.5 shadow-lg shadow-pink-200"
                        title="Agregar nuevo producto"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="font-bold">Nuevo Producto</span>
                    </button>
                </div>
            </div>

            {/* Count + Eliminar productos */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pl-1">
                <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-pink-400"></span>
                    <p className="text-sm text-gray-500 font-medium">
                        Mostrando <span className="font-bold text-gray-900">{productosFiltrados.length}</span> producto{productosFiltrados.length !== 1 ? 's' : ''}
                    </p>
                </div>
                {productosFiltrados.length > 0 && (
                    <button
                        type="button"
                        onClick={() => { setMostrarEliminarProductosModal(true); setProductosSeleccionados(new Set()); }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 hover:border-red-300 font-bold text-sm transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                        Eliminar productos
                    </button>
                )}
            </div>

            {/* Grid */}
            <TablaInventario
                productos={productosFiltrados}
                loading={cargando}
                onEdit={(producto) => {
                    setProductoEditar(producto)
                    setModalAbierto(true)
                }}
                onView={(producto) => {
                    setProductoVer(producto)
                    setDetalleAbierto(true)
                }}
                onDelete={handleEliminar}
            />

            {/* Modal Detalle */}
            <DetalleProducto
                isOpen={detalleAbierto}
                onClose={() => setDetalleAbierto(false)}
                producto={productoVer}
                onEdit={(producto) => {
                    setProductoEditar(producto)
                    setModalAbierto(true)
                }}
            />

            {/* Modal Formulario */}
            <FormularioProducto
                isOpen={modalAbierto}
                onClose={() => setModalAbierto(false)}
                productToEdit={productoEditar}
                onSuccess={obtenerProductos}
                categories={categorias}
            />

            {/* Modal Categorías */}
            <GestionCategorias
                mostrar={gestionCatsAbierto}
                cerrar={() => setGestionCatsAbierto(false)}
                onActualizado={obtenerCategorias}
            />

            {/* Modal Cupones */}
            <GestionCupones
                mostrar={gestionCuponesAbierto}
                cerrar={() => setGestionCuponesAbierto(false)}
            />

            {/* Modal Eliminar productos (como historial de ventas) */}
            {mostrarEliminarProductosModal && (
                <>
                    <div className="modal-backdrop" onClick={() => !eliminandoProductos && setMostrarEliminarProductosModal(false)} />
                    <PastelCard className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col z-[100] !shadow-2xl" noHover>
                        <div className="p-6 border-b border-pink-100">
                            <h3 className="text-xl font-bold text-gray-800">Eliminar productos</h3>
                            <p className="text-sm text-gray-500 mt-1">Seleccioná los productos a eliminar. Esta acción no se puede deshacer.</p>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1 min-h-0">
                            <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-pink-50/50 cursor-pointer mb-2">
                                <input
                                    type="checkbox"
                                    checked={productosFiltrados.length > 0 && productosSeleccionados.size === productosFiltrados.length}
                                    onChange={seleccionarTodosProductos}
                                    className="rounded border-pink-300 text-pink-600 focus:ring-pink-500"
                                />
                                <span className="font-bold text-sm text-gray-700">Seleccionar todos</span>
                            </label>
                            <div className="space-y-2">
                                {productosFiltrados.length === 0 ? (
                                    <p className="text-gray-400 text-sm py-4">No hay productos con los filtros actuales.</p>
                                ) : (
                                    productosFiltrados.map(producto => (
                                        <label
                                            key={producto.id}
                                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-pink-50/50 cursor-pointer border border-transparent hover:border-pink-100"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={productosSeleccionados.has(producto.id)}
                                                onChange={() => toggleSeleccionProducto(producto.id)}
                                                className="rounded border-pink-300 text-pink-600 focus:ring-pink-500"
                                            />
                                            <span className="flex-1 text-sm text-gray-800 truncate">{producto.name}</span>
                                            <span className="text-xs text-gray-400 flex-shrink-0">
                                                {producto.categories?.name ?? 'Sin categoría'} · ${producto.sale_price.toLocaleString()}
                                            </span>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>
                        <div className="p-6 border-t border-pink-100 flex gap-3 justify-end">
                            <button
                                type="button"
                                onClick={() => setMostrarEliminarProductosModal(false)}
                                disabled={eliminandoProductos}
                                className="btn-ghost"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleEliminarProductosSeleccionados}
                                disabled={eliminandoProductos || productosSeleccionados.size === 0}
                                className="px-4 py-2.5 rounded-xl font-bold text-sm bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {eliminandoProductos ? 'Eliminando...' : `Eliminar ${productosSeleccionados.size} producto(s)`}
                            </button>
                        </div>
                    </PastelCard>
                </>
            )}
        </div>
    )
}
