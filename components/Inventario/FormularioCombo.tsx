'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { ComboConItems, Producto } from '@/lib/supabase'
import { Loader, X, Plus, Trash2, Package, Tag, DollarSign, Sparkles, ShoppingBag } from 'lucide-react'
import { useToast } from '@/context/ToastContext'

type ComboItemForm = { product_id: number; quantity: number; product?: Producto }

interface FormularioComboProps {
    isOpen: boolean
    onClose: () => void
    comboToEdit: ComboConItems | null
    onSuccess: () => void
    productos: Producto[]
}

export default function FormularioCombo({ isOpen, onClose, comboToEdit, onSuccess, productos }: FormularioComboProps) {
    const { showSuccess, showError } = useToast()
    const [guardando, setGuardando] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        sale_price: '',
        is_active: true,
    })
    const [items, setItems] = useState<ComboItemForm[]>([])
    const [errores, setErrores] = useState<Record<string, string>>({})

    useEffect(() => {
        if (isOpen) {
            if (comboToEdit) {
                setFormData({
                    name: comboToEdit.name,
                    description: comboToEdit.description || '',
                    sale_price: comboToEdit.sale_price.toString(),
                    is_active: comboToEdit.is_active ?? true,
                })
                const its = (comboToEdit.combo_items || []).map(ci => ({
                    product_id: ci.product_id,
                    quantity: ci.quantity,
                    product: ci.products || productos.find(p => p.id === ci.product_id),
                }))
                setItems(its)
            } else {
                setFormData({ name: '', description: '', sale_price: '', is_active: true })
                setItems([])
            }
            setErrores({})
        }
    }, [isOpen, comboToEdit, productos])

    const agregarItem = () => {
        const primerosDisponibles = productos.filter(p => !items.some(i => i.product_id === p.id))
        if (primerosDisponibles.length === 0) {
            showError('Todos los productos ya están en el combo')
            return
        }
        setItems([...items, { product_id: primerosDisponibles[0].id, quantity: 1, product: primerosDisponibles[0] }])
    }

    const quitarItem = (idx: number) => {
        setItems(items.filter((_, i) => i !== idx))
    }

    const actualizarItem = (idx: number, field: 'product_id' | 'quantity', value: number) => {
        const nuevo = [...items]
        nuevo[idx] = { ...nuevo[idx], [field]: value }
        if (field === 'product_id') {
            nuevo[idx].product = productos.find(p => p.id === value)
        }
        setItems(nuevo)
    }

    const validar = () => {
        const err: Record<string, string> = {}
        if (!formData.name.trim()) err.name = 'El nombre es obligatorio'
        const precio = parseFloat(formData.sale_price)
        if (!formData.sale_price || isNaN(precio) || precio <= 0) err.sale_price = 'El precio debe ser mayor a 0'
        if (items.length === 0) err.items = 'Agregá al menos un producto al combo'
        setErrores(err)
        return Object.keys(err).length === 0
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!validar()) return

        setGuardando(true)
        try {
            const payload = {
                name: formData.name.trim(),
                description: formData.description.trim() || null,
                sale_price: parseFloat(formData.sale_price),
                is_active: formData.is_active,
            }

            let comboId: number
            if (comboToEdit) {
                comboId = comboToEdit.id
                const { error: errCombo } = await supabase
                    .from('combos')
                    .update({ ...payload, updated_at: new Date().toISOString() })
                    .eq('id', comboId)
                if (errCombo) throw errCombo
                await supabase.from('combo_items').delete().eq('combo_id', comboId)
            } else {
                const { data: nuevo, error: errCombo } = await supabase
                    .from('combos')
                    .insert([payload])
                    .select()
                    .single()
                if (errCombo || !nuevo) throw errCombo || new Error('No se creó el combo')
                comboId = nuevo.id
            }
            if (items.length > 0) {
                const rows = items.map(i => ({ combo_id: comboId, product_id: i.product_id, quantity: i.quantity }))
                const { error: errItems } = await supabase.from('combo_items').insert(rows)
                if (errItems) throw errItems
            }

            showSuccess(comboToEdit ? 'Combo actualizado' : 'Combo creado')
            onSuccess()
            onClose()
        } catch (err) {
            console.error(err)
            showError('Error al guardar el combo')
        } finally {
            setGuardando(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
            <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-in-scale">
                {/* Header */}
                <div className="flex-shrink-0 px-8 py-6 bg-gradient-to-br from-pink-500/10 via-rose-50 to-amber-50/50 border-b border-pink-100">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg shadow-pink-300/40 flex-shrink-0">
                                <Package className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                                    {comboToEdit ? 'Editar combo' : 'Nuevo combo'}
                                </h3>
                                <p className="text-sm text-gray-500 mt-0.5">Armá tu paquete de productos</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-white/80 transition-colors flex-shrink-0"
                            aria-label="Cerrar"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                        <div className="space-y-6 max-w-xl mx-auto">
                            {/* Nombre */}
                            <div>
                                <label className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-2 py-[5px]">
                                    <Tag className="w-4 h-4 text-pink-500" />
                                    Nombre del combo <span className="text-pink-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                                    className={`w-full px-4 py-3 rounded-xl border-2 bg-white placeholder-gray-400 outline-none text-base ${
                                        errores.name ? 'border-red-300' : 'border-pink-100 focus:border-pink-300'
                                    }`}
                                    placeholder="Ej: Kit Verano"
                                />
                                {errores.name && <p className="text-red-500 text-sm font-medium mt-1">{errores.name}</p>}
                            </div>

                            {/* Precio */}
                            <div>
                                <label className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-2">
                                    <DollarSign className="w-4 h-4 text-pink-500" />
                                    Precio de venta <span className="text-pink-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    value={formData.sale_price}
                                    onChange={e => setFormData(p => ({ ...p, sale_price: e.target.value }))}
                                    className={`w-full h-10 px-4 py-2 rounded-xl border-2 bg-white placeholder-gray-400 outline-none text-base ${
                                        errores.sale_price ? 'border-red-300' : 'border-pink-100 focus:border-pink-300'
                                    }`}
                                    placeholder="0"
                                />
                                {errores.sale_price && <p className="text-red-500 text-sm font-medium mt-1">{errores.sale_price}</p>}
                            </div>

                            {/* Descripción */}
                            <div>
                                <label className="block text-sm font-bold text-gray-800 mb-2 py-[5px]">Descripción</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                                    rows={2}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-pink-100 bg-white placeholder-gray-400 outline-none focus:border-pink-300 resize-none"
                                    placeholder="Descripción opcional"
                                />
                            </div>

                            {/* Activo */}
                            <label className="flex items-center gap-3 p-4 rounded-xl bg-pink-50 border border-pink-100 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.is_active}
                                    onChange={e => setFormData(p => ({ ...p, is_active: e.target.checked }))}
                                    className="w-5 h-5 rounded border-2 border-pink-300 text-pink-500"
                                />
                                <span className="text-sm font-semibold text-gray-700">Activo (visible en catálogo)</span>
                            </label>

                            {/* Productos */}
                            <div>
                                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                    <label className="flex items-center gap-2 text-sm font-bold text-gray-800">
                                        <Sparkles className="w-4 h-4 text-amber-500" />
                                        Productos del combo <span className="text-pink-500">*</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={agregarItem}
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-pink-500 hover:bg-pink-600 transition-colors my-[5px]"
                                    >
                                        <Plus className="w-4 h-4" /> Agregar
                                    </button>
                                </div>
                                {errores.items && <p className="text-red-500 text-sm font-medium mb-2">{errores.items}</p>}

                                {items.length === 0 ? (
                                    <button
                                        type="button"
                                        onClick={agregarItem}
                                        className="w-full flex flex-col items-center justify-center py-10 rounded-xl border-2 border-dashed border-pink-200 bg-pink-50/50 hover:bg-pink-50 transition-colors"
                                    >
                                        <ShoppingBag className="w-10 h-10 text-pink-300 mb-2" />
                                        <p className="text-sm font-semibold text-gray-600">Sin productos aún</p>
                                        <p className="text-xs text-gray-500 mt-0.5">Click para agregar el primero</p>
                                    </button>
                                ) : (
                                    <div className="space-y-3">
                                        {items.map((item, idx) => {
                                            const prod = item.product || productos.find(p => p.id === item.product_id)
                                            const nombre = prod?.name ?? ''
                                            return (
                                                <div
                                                    key={`${item.product_id}-${idx}`}
                                                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-pink-50/50 border border-pink-100"
                                                >
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
                                                            {prod?.image_url ? (
                                                                <img src={prod.image_url} alt={nombre} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <ShoppingBag className="w-6 h-6 text-gray-400" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <label className="text-xs font-medium text-gray-500 block mb-1">Producto</label>
                                                            <select
                                                                value={item.product_id}
                                                                onChange={e => actualizarItem(idx, 'product_id', parseInt(e.target.value, 10))}
                                                                className="w-full px-3 py-2 rounded-lg border-2 border-pink-100 bg-white text-gray-900 font-medium text-sm outline-none focus:border-pink-300"
                                                            >
                                                                {productos.map(p => (
                                                                    <option key={p.id} value={p.id} disabled={items.some((i, j) => j !== idx && i.product_id === p.id)}>
                                                                        {p.name} {p.stock > 0 ? `(Stock: ${p.stock})` : '(Sin stock)'}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            {prod && (
                                                                <p className="text-xs text-gray-500 mt-1 truncate">{prod.brand || `$${prod.sale_price.toLocaleString()}`}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 sm:flex-shrink-0">
                                                        <label className="text-xs font-medium text-gray-500 whitespace-nowrap">Cant.</label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={item.quantity}
                                                            onChange={e => actualizarItem(idx, 'quantity', Math.max(1, parseInt(e.target.value, 10) || 1))}
                                                            className="w-[75px] min-w-[75px] max-w-[75px] shrink-0 px-2 py-2 rounded-lg border-2 border-pink-100 bg-white text-center font-bold text-gray-800 outline-none focus:border-pink-300"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => quitarItem(idx)}
                                                            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                            aria-label="Quitar"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer - botones con mucho espacio */}
                    <div className="flex-shrink-0 p-8 pt-6 border-t-2 border-gray-100 bg-gray-50/50">
                        <div className="flex flex-col-reverse sm:flex-row gap-4 sm:gap-6">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-6 py-4 rounded-2xl font-bold text-gray-600 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={guardando}
                                className="flex-1 px-6 py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-pink-300/40 transition-all min-h-[52px]"
                            >
                                {guardando ? <Loader className="w-5 h-5 animate-spin" /> : null}
                                {comboToEdit ? 'Guardar cambios' : 'Crear combo'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}
