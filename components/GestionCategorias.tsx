'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, Categoria } from '@/lib/supabase'
import { X, Plus, SquarePen, Trash2, FolderOpen } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import { PastelCard } from '@/components/ui/PastelCard'
import { useConfirm } from '@/hooks/useConfirm'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface Props {
    mostrar: boolean
    cerrar: () => void
    onActualizado: () => void
}

export default function GestionCategorias({ mostrar, cerrar, onActualizado }: Props) {
    const { showSuccess, showError } = useToast()
    const { confirm, confirmProps } = useConfirm()
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
        const ok = await confirm({
            title: '¿Eliminar esta categoría?',
            description: 'No se puede si tiene productos asociados.',
            confirmLabel: 'Eliminar',
            danger: true,
        })
        if (!ok) return

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
            <div className="absolute inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm" onClick={cerrar} aria-hidden />

            <PastelCard className="relative w-full max-w-md !p-0 z-50 shadow-2xl rounded-3xl border border-gray-200 dark:border-gray-700 animate-fade-in-scale overflow-hidden" noHover>
                <div className="px-5 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        <FolderOpen className="w-6 h-6 text-pink-500 dark:text-pink-400" />
                        Categorías
                    </h3>
                    <button
                        onClick={cerrar}
                        className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-colors"
                        aria-label="Cerrar"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 sm:p-6 flex flex-col gap-4">
                    {/* Selector + Nueva */}
                    <div className="flex flex-col gap-2">
                        <label className="form-label text-gray-700 dark:text-gray-200">Seleccionar categoría</label>
                        <div className="flex items-stretch gap-2">
                            <select
                                value={categoriaSeleccionada?.toString() || ''}
                                onChange={(e) => handleSeleccion(e.target.value)}
                                className="form-select form-control-h flex-1 min-w-0"
                            >
                                <option value="">-- Nueva Categoría --</option>
                                {categorias.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                            <button
                                onClick={handleNueva}
                                className="btn-ghost bg-pink-50 dark:bg-pink-900/40 text-pink-600 dark:text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-900/60 min-w-[44px] form-control-h rounded-xl border-0 flex items-center justify-center shrink-0"
                                title="Nueva Categoría"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Input nombre */}
                    <div className="flex flex-col gap-2">
                        <label className="form-label text-gray-700 dark:text-gray-200">
                            {categoriaSeleccionada ? 'Editar nombre' : 'Nombre de nueva categoría'}
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
                            className="form-input form-control-h w-full"
                        />
                    </div>

                    {/* Botones de acción */}
                    <div className="flex gap-3 pt-1">
                        {categoriaSeleccionada ? (
                            <>
                                <button
                                    onClick={handleEditar}
                                    disabled={cargando || !nombre.trim()}
                                    className="btn-primary flex-1 justify-center gap-2 shadow-lg shadow-pink-200"
                                >
                                    <SquarePen size={16} aria-hidden />
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
                    <p className="text-center text-xs text-gray-400 dark:text-gray-500 font-medium pt-1">
                        {categorias.length} categoría{categorias.length !== 1 ? 's' : ''} en total
                    </p>
                </div>
            </PastelCard>
            <ConfirmDialog {...confirmProps} testId="confirm-categoria" />
        </div>
    )
}
