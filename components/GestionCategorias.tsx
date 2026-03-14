'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, Categoria } from '@/lib/supabase'
import { X, Plus, Edit2, Trash2, FolderOpen } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import { PastelCard } from '@/components/ui/PastelCard'

interface Props {
    mostrar: boolean
    cerrar: () => void
    onActualizado: () => void
}

export default function GestionCategorias({ mostrar, cerrar, onActualizado }: Props) {
    const { showSuccess, showError } = useToast()
    const [categorias, setCategorias] = useState<Categoria[]>([])
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<number | null>(null)
    const [nombre, setNombre] = useState('')
    const [cargando, setCargando] = useState(false)

    const obtenerCategorias = useCallback(async () => {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('name')
        if (!error && data) setCategorias(data)
    }, [])

    /* eslint-disable react-hooks/set-state-in-effect -- load categories when modal opens */
    useEffect(() => {
        if (mostrar) {
            obtenerCategorias()
        }
    }, [mostrar, obtenerCategorias])
    /* eslint-enable react-hooks/set-state-in-effect */

    const handleCrear = async () => {
        if (!nombre.trim()) return

        setCargando(true)
        const { error } = await supabase
            .from('categories')
            .insert([{ name: nombre.trim() }])

        if (!error) {
            showSuccess('Categoría creada correctamente')
            setNombre('')
            await obtenerCategorias()
            onActualizado()
        } else {
            showError('Error al crear la categoría')
        }
        setCargando(false)
    }

    const handleEditar = async () => {
        if (!categoriaSeleccionada || !nombre.trim()) return

        setCargando(true)
        const { error } = await supabase
            .from('categories')
            .update({ name: nombre.trim() })
            .eq('id', categoriaSeleccionada)

        if (!error) {
            showSuccess('Categoría actualizada correctamente')
            setNombre('')
            setCategoriaSeleccionada(null)
            await obtenerCategorias()
            onActualizado()
        } else {
            showError('Error al actualizar la categoría')
        }
        setCargando(false)
    }

    const handleEliminar = async () => {
        if (!categoriaSeleccionada) return
        if (!confirm('¿Eliminar esta categoría?')) return

        setCargando(true)
        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', categoriaSeleccionada)

        if (error) {
            console.error(error)
            if (error.code === '23503') { // Foreign key violation code
                showError('No se puede eliminar la categoría porque tiene productos asociados')
            } else {
                showError('Error al eliminar la categoría: ' + error.message)
            }
        } else {
            showSuccess('Categoría eliminada correctamente')
            setCategoriaSeleccionada(null)
            setNombre('')
            await obtenerCategorias()
            onActualizado()
        }
        setCargando(false)
    }

    const handleSeleccion = (id: string) => {
        const catId = parseInt(id)
        setCategoriaSeleccionada(catId)
        const cat = categorias.find(c => c.id === catId)
        if (cat) setNombre(cat.name)
    }

    const handleNueva = () => {
        setCategoriaSeleccionada(null)
        setNombre('')
    }

    if (!mostrar) return null

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" onClick={cerrar} />

            <PastelCard className="w-full max-w-md !p-0 z-50 shadow-2xl animate-fade-in-scale overflow-hidden" noHover>
                <div className="bg-white px-8 py-5 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <FolderOpen className="w-6 h-6 text-pink-500" />
                        Categorías
                    </h3>
                    <button
                        onClick={cerrar}
                        className="w-8 h-8 rounded-full bg-gray-50 text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-8 space-y-5">
                    {/* Selector */}
                    <div>
                        <label className="form-label mb-2 text-gray-700">Seleccionar Categoría</label>
                        <div className="flex gap-2">
                            <select
                                value={categoriaSeleccionada?.toString() || ''}
                                onChange={(e) => handleSeleccion(e.target.value)}
                                className="form-select w-full"
                            >
                                <option value="">-- Nueva Categoría --</option>
                                {categorias.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                            <button
                                onClick={handleNueva}
                                className="btn-ghost bg-pink-50 text-pink-600 hover:bg-pink-100 p-2.5 rounded-xl border-0"
                                title="Nueva Categoría"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Input nombre */}
                    <div>
                        <label className="form-label mb-2 text-gray-700">
                            {categoriaSeleccionada ? 'Editar Nombre' : 'Nombre de Nueva Categoría'}
                        </label>
                        <input
                            type="text"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            placeholder="Ej: Labiales, Sombras..."
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    if (categoriaSeleccionada) handleEditar()
                                    else handleCrear()
                                }
                            }}
                            className="form-input w-full"
                        />
                    </div>

                    {/* Botones de acción */}
                    <div className="flex gap-3 pt-2">
                        {categoriaSeleccionada ? (
                            <>
                                <button
                                    onClick={handleEditar}
                                    disabled={cargando || !nombre.trim()}
                                    className="btn-primary flex-1 justify-center gap-2 shadow-lg shadow-pink-200"
                                >
                                    <Edit2 className="w-4 h-4" />
                                    Actualizar
                                </button>
                                <button
                                    onClick={handleEliminar}
                                    disabled={cargando}
                                    className="btn-danger px-4"
                                    title="Eliminar Categoría"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleCrear}
                                disabled={cargando || !nombre.trim()}
                                className="btn-primary w-full justify-center gap-2 shadow-lg shadow-pink-200"
                            >
                                <Plus className="w-4 h-4" />
                                Crear Categoría
                            </button>
                        )}
                    </div>

                    {/* Info */}
                    <p className="text-center text-xs text-gray-400 font-medium">
                        {categorias.length} categoría{categorias.length !== 1 ? 's' : ''} en total
                    </p>
                </div>
            </PastelCard>
        </div>
    )
}
