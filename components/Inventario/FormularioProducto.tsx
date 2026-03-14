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
        image_urls: [] as string[],
        discount_percentage: '',
        visible_in_catalog: true
    })

    // Reset form when opening/closing or changing product
    useEffect(() => {
        if (isOpen) {
            if (productToEdit) {
                const urls = productToEdit.image_urls?.length
                    ? productToEdit.image_urls
                    : productToEdit.image_url
                        ? [productToEdit.image_url]
                        : []
                setFormData({
                    name: productToEdit.name,
                    category_id: productToEdit.category_id?.toString() || '',
                    brand: productToEdit.brand || '',
                    purchase_price: productToEdit.purchase_price?.toString() || '',
                    sale_price: productToEdit.sale_price.toString(),
                    stock: productToEdit.stock.toString(),
                    min_stock: productToEdit.min_stock.toString(),
                    notes: productToEdit.notes || '',
                    image_urls: urls,
                    discount_percentage: productToEdit.discount_percentage != null ? String(productToEdit.discount_percentage) : '',
                    visible_in_catalog: productToEdit.visible_in_catalog !== false
                })
            } else {
                setFormData({
                    name: '', category_id: '', brand: '',
                    purchase_price: '', sale_price: '', stock: '', min_stock: '1', notes: '', image_urls: [], discount_percentage: '',
                    visible_in_catalog: true
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
            const newUrls: string[] = []
            for (let i = 0; i < e.target.files.length; i++) {
                const file = e.target.files[i]
                const fileExt = file.name.split('.').pop()
                const fileName = `${Math.random()}.${fileExt}`
                const filePath = `${fileName}`

                const { error: uploadError } = await supabase.storage
                    .from('productos')
                    .upload(filePath, file)

                if (uploadError) throw uploadError

                const { data } = supabase.storage.from('productos').getPublicUrl(filePath)
                newUrls.push(data.publicUrl)
            }
            setFormData(prev => ({ ...prev, image_urls: [...prev.image_urls, ...newUrls] }))
            showSuccess(newUrls.length > 1 ? `${newUrls.length} imágenes subidas` : 'Imagen subida correctamente')
        } catch (error) {
            showError('Error al subir la imagen')
            console.error(error)
        } finally {
            setUploading(false)
        }
        e.target.value = ''
    }

    const quitarImagen = (index: number) => {
        setFormData(prev => ({
            ...prev,
            image_urls: prev.image_urls.filter((_, i) => i !== index)
        }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!validarFormulario()) return

        setGuardando(true)
        const imageUrls = formData.image_urls.length ? formData.image_urls : null
        const datosProducto = {
            name: formData.name.trim(),
            category_id: formData.category_id ? parseInt(formData.category_id) : null,
            brand: formData.brand.trim() || null,
            purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
            sale_price: parseFloat(formData.sale_price),
            stock: parseInt(formData.stock),
            min_stock: formData.min_stock ? parseInt(formData.min_stock) : 5,
            notes: formData.notes.trim() || null,
            image_url: imageUrls?.[0] ?? null,
            image_urls: imageUrls,
            discount_percentage: formData.discount_percentage ? Math.min(100, Math.max(0, parseInt(formData.discount_percentage) || 0)) : 0,
            visible_in_catalog: formData.visible_in_catalog
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
            <div className="absolute inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />

            <PastelCard className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto !p-0 z-50 shadow-2xl rounded-3xl border border-gray-200 dark:border-gray-700 animate-fade-in-scale" noHover>
                <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md px-6 sm:px-8 py-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 tracking-tight flex items-center gap-2">
                            <span className="text-pink-500 dark:text-pink-400">✦</span>
                            {productToEdit ? 'Editar Producto' : 'Nuevo Producto'}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            {productToEdit ? 'Modifica los detalles del producto' : 'Agrega un nuevo ítem a tu inventario'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-colors"
                        aria-label="Cerrar"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="form-body p-6 sm:p-8">
                    {/* Imágenes: bloque destacado */}
                    <div className="form-section">
                        <label className="form-label">Imágenes del producto</label>
                        <div className="rounded-2xl border border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-800/50 p-5 sm:p-6 min-h-[140px] flex flex-col justify-center">
                            <div className="flex flex-wrap gap-4 items-center">
                                {formData.image_urls.map((url, index) => (
                                    <div key={url} className="relative w-24 h-24 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 overflow-hidden group shrink-0">
                                        <Image src={url} alt={`Preview ${index + 1}`} fill className="object-cover" sizes="96px" />
                                        <button
                                            type="button"
                                            onClick={() => quitarImagen(index)}
                                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                                            aria-label="Quitar imagen"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                                <label className="w-24 h-24 shrink-0 rounded-xl bg-white dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-500 flex items-center justify-center cursor-pointer hover:border-pink-400 dark:hover:border-pink-500 transition-colors">
                                    {uploading ? (
                                        <Loader className="animate-spin text-pink-400 w-7 h-7" />
                                    ) : (
                                        <Upload className="w-7 h-7 text-gray-400 dark:text-gray-500" />
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleImageUpload}
                                        disabled={uploading}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                                Podés subir varias. JPG, PNG o WEBP. En el catálogo se podrán deslizar.
                            </p>
                        </div>
                    </div>

                    {/* Nombre */}
                    <div className="form-section">
                        <label className="form-label">Nombre del producto <span className="text-pink-500">*</span></label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Ej: Labial Mate Ruby Woo"
                            className={`form-input form-control-h w-full ${errores.name ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}`}
                        />
                        {errores.name && <p className="text-xs text-red-500 mt-1">{errores.name}</p>}
                    </div>

                    {/* Categoría y Marca */}
                    <div className="form-section">
                        <div className="form-section-fields grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="min-w-0">
                                <label className="form-label">Categoría</label>
                                <select
                                    value={formData.category_id}
                                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                    className="form-select form-control-h w-full"
                                >
                                    <option value="">Sin categoría</option>
                                    {categories.map(cat => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                                </select>
                            </div>
                            <div className="min-w-0">
                                <label className="form-label">Marca</label>
                                <input
                                    type="text"
                                    value={formData.brand}
                                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                    placeholder="Ej: MAC"
                                    className="form-input form-control-h w-full"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Precio compra y venta */}
                    <div className="form-section">
                        <div className="form-section-fields grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="min-w-0">
                                <label className="form-label">Precio compra</label>
                                <div className="relative">
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.purchase_price}
                                        onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                                        placeholder="0.00"
                                        className="form-input form-control-h w-full pr-8"
                                    />
                                </div>
                            </div>
                            <div className="min-w-0">
                                <label className="form-label">Precio venta <span className="text-pink-500">*</span></label>
                                <div className="relative">
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.sale_price}
                                        onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                                        placeholder="0.00"
                                        className={`form-input form-control-h w-full pr-8 ${errores.sale_price ? 'border-red-300' : ''}`}
                                    />
                                </div>
                                {errores.sale_price && <p className="text-xs text-red-500 mt-1">{errores.sale_price}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Stock actual y alerta */}
                    <div className="form-section">
                        <div className="form-section-fields grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="min-w-0">
                                <label className="form-label">Stock actual <span className="text-pink-500">*</span></label>
                                <input
                                    type="number"
                                    min={0}
                                    value={formData.stock}
                                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                                    placeholder="0"
                                    className={`form-input form-control-h w-full ${errores.stock ? 'border-red-300' : ''}`}
                                />
                                {errores.stock && <p className="text-xs text-red-500 mt-1">{errores.stock}</p>}
                            </div>
                            <div className="min-w-0">
                                <label className="form-label">Alerta stock bajo</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={formData.min_stock}
                                    onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                                    placeholder="5"
                                    className="form-input form-control-h w-full"
                                />
                                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">Aviso cuando el stock baje de este valor</p>
                            </div>
                        </div>
                    </div>

                    {/* Visible en catálogo: bloque de configuración */}
                    <div className="form-section">
                        <div className="rounded-2xl border border-gray-200 dark:border-gray-600 bg-gray-50/60 dark:bg-gray-800/40 p-5 sm:p-6">
                            <label className="flex items-center gap-4 cursor-pointer has-[:checked]:[&_.track]:bg-pink-400 has-[:checked]:[&_.thumb]:translate-x-6">
                                <input
                                    type="checkbox"
                                    checked={formData.visible_in_catalog}
                                    onChange={(e) => setFormData({ ...formData, visible_in_catalog: e.target.checked })}
                                    className="sr-only"
                                />
                                <span className="relative flex h-8 w-14 flex-shrink-0">
                                    <span className="track block h-8 w-14 rounded-full bg-gray-200 transition-colors duration-200" />
                                    <span className="thumb absolute left-1 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-out" />
                                </span>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Visible en el catálogo público</span>
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 ml-[4.5rem] leading-relaxed">
                                Desactivá para ocultar este producto del catálogo (ideal cuando cargás algo sin precio o fotos).
                            </p>
                        </div>
                    </div>

                    {/* Descuento en catálogo */}
                    <div className="form-section">
                        <label className="form-label">Descuento en catálogo (%)</label>
                        <input
                            type="number"
                            min={0}
                            max={100}
                            value={formData.discount_percentage}
                            onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
                            placeholder="0"
                            className="form-input form-control-h w-full max-w-[120px]"
                        />
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">Si es mayor a 0, en el catálogo público se muestra &quot;En descuento&quot; y el precio rebajado.</p>
                    </div>

                    {/* Notas */}
                    <div className="form-section">
                        <label className="form-label">Notas adicionales</label>
                        <textarea
                            rows={3}
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Detalles, ubicación, etc."
                            className="form-input w-full resize-none form-textarea-min"
                        />
                    </div>

                    <div className="form-footer-bar flex gap-4 border-gray-200 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={guardando}
                            className="btn-ghost flex-1 form-control-h text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={uploading || guardando}
                            className="btn-primary flex-[2] justify-center form-control-h text-base shadow-lg shadow-pink-200 dark:shadow-pink-900/30"
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
