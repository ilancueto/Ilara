'use client'

import { useState, useEffect } from 'react'
import { supabase, Producto, Categoria } from '@/lib/supabase'
import { Settings, Search, Plus } from 'lucide-react'
import GestionCategorias from '../GestionCategorias'
import { useToast } from '@/context/ToastContext'
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
    const [productoEditar, setProductoEditar] = useState<Producto | null>(null)
    const [productoVer, setProductoVer] = useState<Producto | null>(null)

    // Filter states
    const [terminoBusqueda, setTerminoBusqueda] = useState('')
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('all')

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

            {/* Count */}
            <div className="flex items-center gap-3 pl-1">
                <span className="w-2 h-2 rounded-full bg-pink-400"></span>
                <p className="text-sm text-gray-500 font-medium">
                    Mostrando <span className="font-bold text-gray-900">{productosFiltrados.length}</span> producto{productosFiltrados.length !== 1 ? 's' : ''}
                </p>
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
        </div>
    )
}
