'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { supabase, Producto, Categoria, ComboConItems, getProductImages } from '@/lib/supabase'
import { Settings, Search, Plus, Trash2, Tag, Package, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import GestionCategorias from '../GestionCategorias'
import GestionCupones from '../GestionCupones'
import { useToast } from '@/context/ToastContext'
import { PastelCard } from '@/components/ui/PastelCard'
import TablaInventario from './TablaInventario'
import TablaCombos from './TablaCombos'
import FormularioProducto from './FormularioProducto'
import FormularioCombo from './FormularioCombo'
import DetalleProducto from './DetalleProducto'

export default function Inventario() {
    const { showSuccess, showError } = useToast()
    const [productos, setProductos] = useState<Producto[]>([])
    const [categorias, setCategorias] = useState<Categoria[]>([])
    const [combos, setCombos] = useState<ComboConItems[]>([])
    const [cargando, setCargando] = useState(true)
    const [tabActiva, setTabActiva] = useState<'productos' | 'combos' | 'reposicion'>('productos')

    // Modal states
    const [modalAbierto, setModalAbierto] = useState(false)
    const [detalleAbierto, setDetalleAbierto] = useState(false)
    const [gestionCatsAbierto, setGestionCatsAbierto] = useState(false)
    const [gestionCuponesAbierto, setGestionCuponesAbierto] = useState(false)
    const [productoEditar, setProductoEditar] = useState<Producto | null>(null)
    const [productoVer, setProductoVer] = useState<Producto | null>(null)
    const [modalComboAbierto, setModalComboAbierto] = useState(false)
    const [comboEditar, setComboEditar] = useState<ComboConItems | null>(null)
    const [mostrarAjusteUmbral, setMostrarAjusteUmbral] = useState(false)

    // Filter states
    const [terminoBusqueda, setTerminoBusqueda] = useState('')
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('all')

    // Umbral stock crítico (se usa en el tablero para incluir productos con stock ≤ este valor)
    const [umbralStockCritico, setUmbralStockCritico] = useState<number | null>(() => {
        if (typeof window === 'undefined') return null
        const s = localStorage.getItem('ilara-umbral-stock-critico')
        if (s === null || s === '') return null
        const n = parseInt(s, 10)
        return Number.isFinite(n) && n >= 0 ? n : null
    })

    useEffect(() => {
        if (typeof window === 'undefined') return
        if (umbralStockCritico === null) localStorage.removeItem('ilara-umbral-stock-critico')
        else localStorage.setItem('ilara-umbral-stock-critico', String(umbralStockCritico))
    }, [umbralStockCritico])

    // Eliminar productos (modal como historial de ventas)
    const [mostrarEliminarProductosModal, setMostrarEliminarProductosModal] = useState(false)
    const [productosSeleccionados, setProductosSeleccionados] = useState<Set<number>>(new Set())
    const [eliminandoProductos, setEliminandoProductos] = useState(false)

    // Ocultar / mostrar en catálogo (modal múltiple)
    const [mostrarVisibilidadModal, setMostrarVisibilidadModal] = useState(false)
    const [actualizandoVisibilidad, setActualizandoVisibilidad] = useState(false)

    useEffect(() => {
        obtenerData()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on mount only
    }, [])

    const obtenerData = async () => {
        setCargando(true)
        await Promise.all([obtenerProductos(), obtenerCategorias(), obtenerCombos()])
        setCargando(false)
    }

    const obtenerCombos = async () => {
        const { data, error } = await supabase
            .from('combos')
            .select(`
                *,
                combo_items (
                    id, combo_id, product_id, quantity,
                    products (*, categories(name))
                )
            `)
            .order('created_at', { ascending: false })
        if (!error && data) setCombos(data as ComboConItems[])
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

    const handleEliminarCombo = async (id: number) => {
        if (confirm('¿Eliminar este combo?')) {
            const { error } = await supabase.from('combos').delete().eq('id', id)
            if (!error) {
                showSuccess('Combo eliminado')
                obtenerCombos()
            } else {
                showError('Error al eliminar el combo')
            }
        }
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

    const actualizarVisibilidadSeleccionados = async (visible: boolean) => {
        if (productosSeleccionados.size === 0) {
            showError('Seleccioná al menos un producto.')
            return
        }
        setActualizandoVisibilidad(true)
        try {
            const ids = Array.from(productosSeleccionados)
            for (const id of ids) {
                const { error } = await supabase
                    .from('products')
                    .update({ visible_in_catalog: visible })
                    .eq('id', id)
                if (error) throw error
            }
            setProductos(prev => prev.map(p => ids.includes(p.id) ? { ...p, visible_in_catalog: visible } : p))
            setProductosSeleccionados(new Set())
            setMostrarVisibilidadModal(false)
            showSuccess(visible ? 'Productos visibles en el catálogo.' : 'Productos ocultos del catálogo.')
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Error al actualizar'
            showError(msg)
        } finally {
            setActualizandoVisibilidad(false)
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

    // Productos para reposición (mismo criterio que en el tablero)
    const productosParaReposicion = productos.filter(
        p => p.stock < p.min_stock || (umbralStockCritico != null && p.stock <= umbralStockCritico)
    )

    return (
        <div className="max-w-7xl mx-auto flex flex-col gap-12">
            {/* Tabs Productos | Combos | Lista para reposición */}
            <div className="flex flex-wrap gap-2 p-1.5 bg-gray-100 rounded-2xl w-fit">
                <button
                    type="button"
                    onClick={() => setTabActiva('productos')}
                    className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-colors ${
                        tabActiva === 'productos' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Productos
                </button>
                <button
                    type="button"
                    onClick={() => setTabActiva('combos')}
                    className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 ${
                        tabActiva === 'combos' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <Package className="w-4 h-4" /> Combos
                </button>
                <button
                    type="button"
                    onClick={() => setTabActiva('reposicion')}
                    className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 ${
                        tabActiva === 'reposicion' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <AlertTriangle className="w-4 h-4" /> Lista para reposición
                </button>
            </div>

            {tabActiva === 'productos' && (
            <>
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
                        className="w-full sm:w-auto bg-white border border-pink-100 rounded-xl py-3 px-4 text-sm font-medium text-gray-700 shadow-sm transition-all outline-none cursor-pointer hover:border-pink-200 hover:bg-pink-50/30 focus:border-pink-300 focus:ring-2 focus:ring-pink-200/50 focus:bg-white"
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
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => { setMostrarVisibilidadModal(true); setProductosSeleccionados(new Set()); }}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-gray-600 hover:text-gray-800 hover:bg-gray-50 border border-pink-200 hover:border-pink-300 font-bold text-sm transition-colors"
                        >
                            <Eye className="w-4 h-4" />
                            Ocultar / Mostrar en catálogo
                        </button>
                        <button
                            type="button"
                            onClick={() => { setMostrarEliminarProductosModal(true); setProductosSeleccionados(new Set()); }}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 hover:border-red-300 font-bold text-sm transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            Eliminar productos
                        </button>
                    </div>
                )}
            </div>

            {/* Grid Productos */}
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
            </>
            )}

            {tabActiva === 'combos' && (
            <>
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white p-7 rounded-[24px] border border-pink-100 shadow-sm">
                <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-pink-400"></span>
                    <p className="text-sm text-gray-500 font-medium">
                        <span className="font-bold text-gray-900">{combos.length}</span> combo{combos.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <button
                    onClick={() => { setComboEditar(null); setModalComboAbierto(true) }}
                    className="btn-primary flex items-center justify-center gap-2 px-6 py-2.5 shadow-lg shadow-pink-200"
                >
                    <Plus className="w-5 h-5" />
                    <span className="font-bold">Nuevo Combo</span>
                </button>
            </div>
            <TablaCombos
                combos={combos}
                loading={cargando}
                onEdit={(combo) => { setComboEditar(combo); setModalComboAbierto(true) }}
                onDelete={handleEliminarCombo}
            />
            </>
            )}

            {tabActiva === 'reposicion' && (
            <>
            <PastelCard noHover className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        Lista para reposición
                    </h3>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setMostrarAjusteUmbral(prev => !prev)}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-colors"
                            title="Ajustar umbral"
                            aria-expanded={mostrarAjusteUmbral}
                        >
                            <Settings className="w-4 h-4" />
                            <span className="text-sm font-medium">
                                {umbralStockCritico != null ? `Umbral: ${umbralStockCritico}` : 'Ajustar umbral'}
                            </span>
                        </button>
                        {mostrarAjusteUmbral && (
                            <>
                                <div className="absolute right-0 top-full mt-2 z-10 w-72 p-4 rounded-xl border border-pink-100 bg-white shadow-lg">
                                    <p className="text-sm font-medium text-gray-700 mb-2">Umbral de stock</p>
                                    <p className="text-xs text-gray-500 mb-3">
                                        Además de los que están bajo su mínimo, incluir productos con stock ≤
                                    </p>
                                    <input
                                        type="number"
                                        min={0}
                                        step={1}
                                        value={umbralStockCritico ?? ''}
                                        onChange={(e) => {
                                            const v = e.target.value
                                            if (v === '') {
                                                setUmbralStockCritico(null)
                                                return
                                            }
                                            const n = parseInt(v, 10)
                                            if (Number.isFinite(n) && n >= 0) setUmbralStockCritico(n)
                                        }}
                                        placeholder="ej. 5 (opcional)"
                                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-800 focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20"
                                    />
                                    <p className="text-xs text-gray-400 mt-2">Dejá vacío para usar solo el mínimo de cada producto.</p>
                                </div>
                                <button
                                    type="button"
                                    className="fixed inset-0 z-[5]"
                                    aria-label="Cerrar"
                                    onClick={() => setMostrarAjusteUmbral(false)}
                                />
                            </>
                        )}
                    </div>
                </div>
                <p className="text-xs text-gray-400 mb-6">
                    Los mismos productos se ven en “Stock Crítico” en el tablero.
                </p>
                {productosParaReposicion.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-2xl">
                        <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p className="font-medium">No hay productos para reposición</p>
                        <p className="text-sm mt-1">Subí el umbral o revisá los mínimos de cada producto.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-2 scrollbar-hide">
                        {productosParaReposicion.map(prod => (
                            <div
                                key={prod.id}
                                className="flex items-center justify-between px-5 py-4 rounded-xl bg-amber-50 border border-amber-100"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-white flex-shrink-0 overflow-hidden flex items-center justify-center border border-amber-100">
                                        {getProductImages(prod)[0] ? (
                                            <Image src={getProductImages(prod)[0]} alt={prod.name} width={40} height={40} className="w-full h-full object-cover" />
                                        ) : (
                                            <AlertTriangle className="w-5 h-5 text-amber-300" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800 text-sm">{prod.name}</p>
                                        <p className="text-xs text-amber-600 font-medium">Mín: {prod.min_stock}</p>
                                    </div>
                                </div>
                                <div className="text-center px-4 py-2 rounded-lg bg-white border border-amber-100 shadow-sm">
                                    <p className="text-[10px] text-amber-500 uppercase font-bold tracking-wider mb-0.5">Stock</p>
                                    <p className={`font-bold text-lg ${prod.stock === 0 ? 'text-red-500' : 'text-gray-800'}`}>{prod.stock}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </PastelCard>
            </>
            )}

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

            {/* Modal Formulario Combo */}
            <FormularioCombo
                isOpen={modalComboAbierto}
                onClose={() => { setModalComboAbierto(false); setComboEditar(null) }}
                comboToEdit={comboEditar}
                onSuccess={obtenerCombos}
                productos={productos}
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

            {/* Modal Ocultar / Mostrar en catálogo */}
            {mostrarVisibilidadModal && (
                <>
                    <div className="modal-backdrop" onClick={() => !actualizandoVisibilidad && setMostrarVisibilidadModal(false)} />
                    <PastelCard className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col z-[100] !shadow-2xl" noHover>
                        <div className="p-6 border-b border-pink-100">
                            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <Eye className="w-5 h-5 text-pink-500" />
                                Visibilidad en catálogo
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">Seleccioná los productos y elegí si ocultarlos o mostrarlos en el catálogo público.</p>
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
                                            <span className={`text-xs flex-shrink-0 px-2 py-0.5 rounded-full ${producto.visible_in_catalog === false ? 'bg-gray-200 text-gray-600' : 'bg-pink-100 text-pink-600'}`}>
                                                {producto.visible_in_catalog === false ? 'Oculto' : 'Visible'}
                                            </span>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>
                        <div className="p-6 border-t border-pink-100 flex flex-wrap gap-3 justify-end">
                            <button
                                type="button"
                                onClick={() => setMostrarVisibilidadModal(false)}
                                disabled={actualizandoVisibilidad}
                                className="btn-ghost"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => actualizarVisibilidadSeleccionados(false)}
                                disabled={actualizandoVisibilidad || productosSeleccionados.size === 0}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <EyeOff className="w-4 h-4" />
                                Ocultar ({productosSeleccionados.size})
                            </button>
                            <button
                                type="button"
                                onClick={() => actualizarVisibilidadSeleccionados(true)}
                                disabled={actualizandoVisibilidad || productosSeleccionados.size === 0}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-pink-50 text-pink-600 hover:bg-pink-100 border border-pink-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Eye className="w-4 h-4" />
                                Mostrar ({productosSeleccionados.size})
                            </button>
                        </div>
                    </PastelCard>
                </>
            )}
        </div>
    )
}
