'use client'

import { useState, useEffect } from 'react'
import { supabase, getUser, Producto, Categoria } from '@/lib/supabase'
import { Loader, X, Upload, Trash2 } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import Image from 'next/image'
import { PastelCard } from '@/components/ui/PastelCard'

interface ProductFormProps {
    isOpen: boolean
    onClose: () => void
    productToEdit: Producto | null
    onSuccess: () => void
    categories: Categoria[]
}

export default function ProductForm({ isOpen, onClose, productToEdit, onSuccess, categories }: ProductFormProps) {
    const { showSuccess, showError } = useToast()
    const [guardando, setGuardando] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [errores, setErrores] = useState<{ [key: string]: string }>({})

    const [formData, setFormData] = useState({
        name: '',
        category_id: '',
        brand: '',
        purchase_price: '',
        sale_price: '',
        stock: '',
        min_stock: '1',
        notes: '',
        image_url: '',
        discount_percentage: ''
    })

    // Reset form when opening/closing or changing product
    useEffect(() => {
        if (isOpen) {
            if (productToEdit) {
                setFormData({
                    name: productToEdit.name,
                    category_id: productToEdit.category_id?.toString() || '',
                    brand: productToEdit.brand || '',
                    purchase_price: productToEdit.purchase_price?.toString() || '',
                    sale_price: productToEdit.sale_price.toString(),
                    stock: productToEdit.stock.toString(),
                    min_stock: productToEdit.min_stock.toString(),
                    notes: productToEdit.notes || '',
                    image_url: productToEdit.image_url || '',
                    discount_percentage: productToEdit.discount_percentage != null ? String(productToEdit.discount_percentage) : ''
                })
            } else {
                setFormData({
                    name: '', category_id: '', brand: '',
                    purchase_price: '', sale_price: '', stock: '', min_stock: '1', notes: '', image_url: '', discount_percentage: ''
                })
            }
            setErrores({})
        }
    }, [isOpen, productToEdit])

    const validarFormulario = () => {
        const nuevosErrores: { [key: string]: string } = {}

        if (!formData.name.trim()) {
            nuevosErrores.name = 'El nombre es obligatorio'
        }

        if (!formData.sale_price || parseFloat(formData.sale_price) <= 0) {
            nuevosErrores.sale_price = 'El precio de venta debe ser mayor a 0'
        }

        if (formData.purchase_price && formData.sale_price) {
            const compra = parseFloat(formData.purchase_price)
            const venta = parseFloat(formData.sale_price)
            if (venta <= compra) {
                nuevosErrores.sale_price = 'El precio de venta debe ser mayor al de compra'
            }
        }

        if (!formData.stock || parseInt(formData.stock) < 0) {
            nuevosErrores.stock = 'El stock no puede ser negativo'
        }

        setErrores(nuevosErrores)
        return Object.keys(nuevosErrores).length === 0
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return

        try {
            setUploading(true)
            const file = e.target.files[0]
            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random()}.${fileExt}`
            const filePath = `${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('productos')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data } = supabase.storage.from('productos').getPublicUrl(filePath)

            setFormData(prev => ({ ...prev, image_url: data.publicUrl }))
            showSuccess('Imagen subida correctamente')
        } catch (error) {
            showError('Error al subir la imagen')
            console.error(error)
        } finally {
            setUploading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!validarFormulario()) return

        setGuardando(true)
        const datosProducto = {
            name: formData.name.trim(),
            category_id: formData.category_id ? parseInt(formData.category_id) : null,
            brand: formData.brand.trim() || null,
            purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
            sale_price: parseFloat(formData.sale_price),
            stock: parseInt(formData.stock),
            min_stock: formData.min_stock ? parseInt(formData.min_stock) : 5,
            notes: formData.notes.trim() || null,
            image_url: formData.image_url || null,
            discount_percentage: formData.discount_percentage ? Math.min(100, Math.max(0, parseInt(formData.discount_percentage) || 0)) : 0
        }
        const user = await getUser()
        if (productToEdit && user?.id) {
            (datosProducto as Record<string, unknown>).updated_by = user.id
        } else if (!productToEdit && user?.id) {
            (datosProducto as Record<string, unknown>).created_by = user.id
        }

        try {
            if (productToEdit) {
                const { error } = await supabase
                    .from('products').update(datosProducto).eq('id', productToEdit.id)
                if (error) throw error
                showSuccess('Producto actualizado correctamente')
            } else {
                const { error } = await supabase
                    .from('products').insert([datosProducto])
                if (error) throw error
                showSuccess('Producto creado correctamente')
            }
            onSuccess()
            onClose()
        } catch (error) {
            showError(productToEdit ? 'Error al actualizar' : 'Error al crear')
            console.error(error)
        } finally {
            setGuardando(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <PastelCard className="w-full max-w-2xl max-h-[90vh] overflow-y-auto !p-0 z-50 shadow-2xl animate-fade-in-scale" noHover>
                <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md px-8 py-5 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 tracking-tight flex items-center gap-2">
                            <span className="text-pink-500">✦</span>
                            {productToEdit ? 'Editar Producto' : 'Nuevo Producto'}
                        </h3>
                        <p className="text-sm text-gray-500 mt-0.5">
                            {productToEdit ? 'Modifica los detalles del producto' : 'Agrega un nuevo ítem a tu inventario'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 hover:text-gray-700 hover:bg-gray-200 flex items-center justify-center transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8">
                    <div className="space-y-6">
                        {/* Imagen */}
                        <div className="flex flex-col sm:flex-row gap-4 sm:items-start">
                            <div className="w-24 h-24 shrink-0 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden relative group hover:border-pink-300 transition-colors">
                                {uploading ? (
                                    <Loader className="animate-spin text-pink-400 w-6 h-6" />
                                ) : formData.image_url ? (
                                    <Image
                                        src={formData.image_url}
                                        alt="Preview"
                                        fill
                                        className="object-cover"
                                    />
                                ) : (
                                    <Upload className="w-6 h-6 text-gray-300 group-hover:text-pink-400" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <label className="btn-ghost inline-flex items-center gap-2 bg-pink-50 text-pink-600 hover:bg-pink-100 cursor-pointer px-4 py-2.5 rounded-xl text-sm font-semibold border-0 mb-1.5">
                                    {uploading ? 'Subiendo...' : 'Subir Imagen'}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        disabled={uploading}
                                        className="hidden"
                                    />
                                </label>
                                <p className="text-xs text-gray-500">
                                    JPG, PNG o WEBP. Máx 2MB.
                                </p>
                                {formData.image_url && (
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, image_url: '' })}
                                        className="mt-2 text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
                                    >
                                        <Trash2 size={12} /> Quitar imagen
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Nombre */}
                        <div>
                            <label className="form-label">Nombre del producto <span className="text-pink-500">*</span></label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ej: Labial Mate Ruby Woo"
                                className={`form-input w-full ${errores.name ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}`}
                            />
                            {errores.name && <p className="text-xs text-red-500 mt-1">{errores.name}</p>}
                        </div>

                        {/* Categoría y Marca */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label className="form-label">Categoría</label>
                                <select
                                    value={formData.category_id}
                                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                    className="form-select w-full"
                                >
                                    <option value="">Sin categoría</option>
                                    {categories.map(cat => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                                </select>
                            </div>
                            <div>
                                <label className="form-label">Marca</label>
                                <input
                                    type="text"
                                    value={formData.brand}
                                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                    placeholder="Ej: MAC"
                                    className="form-input w-full"
                                />
                            </div>
                        </div>

                        {/* Precio compra y venta — misma fila, sin recuadro */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label className="form-label">Precio compra</label>
                                <div className="relative">
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.purchase_price}
                                        onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                                        placeholder="0.00"
                                        className="form-input w-full pr-8"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="form-label">Precio venta <span className="text-pink-500">*</span></label>
                                <div className="relative">
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.sale_price}
                                        onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                                        placeholder="0.00"
                                        className={`form-input w-full pr-8 ${errores.sale_price ? 'border-red-300' : ''}`}
                                    />
                                </div>
                                {errores.sale_price && <p className="text-xs text-red-500 mt-1">{errores.sale_price}</p>}
                            </div>
                        </div>

                        {/* Stock y alerta — etiquetas en una línea */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label className="form-label">Stock actual <span className="text-pink-500">*</span></label>
                                <input
                                    type="number"
                                    min={0}
                                    value={formData.stock}
                                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                                    placeholder="0"
                                    className={`form-input w-full ${errores.stock ? 'border-red-300' : ''}`}
                                />
                                {errores.stock && <p className="text-xs text-red-500 mt-1">{errores.stock}</p>}
                            </div>
                            <div>
                                <label className="form-label">Alerta stock bajo</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={formData.min_stock}
                                    onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                                    placeholder="5"
                                    className="form-input w-full"
                                />
                                <p className="text-[11px] text-gray-400 mt-1">Aviso cuando el stock baje de este valor</p>
                            </div>
                        </div>

                        {/* Descuento en catálogo */}
                        <div>
                            <label className="form-label">Descuento en catálogo (%)</label>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={formData.discount_percentage}
                                onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
                                placeholder="0"
                                className="form-input w-full max-w-[120px]"
                            />
                            <p className="text-[11px] text-gray-400 mt-1">Si es mayor a 0, en el catálogo público se muestra &quot;En descuento&quot; y el precio rebajado.</p>
                        </div>

                        {/* Notas */}
                        <div>
                            <label className="form-label">Notas adicionales</label>
                            <textarea
                                rows={2}
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Detalles, ubicación, etc."
                                className="form-input w-full resize-none"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-6 mt-6 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={guardando}
                            className="btn-ghost flex-1 py-3 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={uploading || guardando}
                            className="btn-primary flex-[2] justify-center py-3 text-base shadow-lg shadow-pink-200"
                        >
                            {guardando ? (
                                <span className="flex items-center gap-2">
                                    <Loader className="animate-spin w-4 h-4" />
                                    Guardando...
                                </span>
                            ) : productToEdit ? 'Guardar Cambios' : 'Crear Producto'}
                        </button>
                    </div>
                </form>
            </PastelCard>
        </div>
    )
}
