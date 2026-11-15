'use client'

import { Eye, EyeOff } from 'lucide-react'
import { CATALOG_BADGE_OPTIONS, type CatalogBadgeKey, etiquetaBadgeCatalogo } from '@/lib/catalogBadges'
import { BulkActionDialog, BulkSelectList } from '@/components/ui/BulkActionDialog'
import type { Producto } from '@/lib/supabase'

type BaseProps = {
    open: boolean
    onClose: () => void
    loading: boolean
    error: string | null
    productos: Producto[]
    seleccionados: Set<number>
    onToggleAll: () => void
    onToggle: (id: number) => void
}

/** Cierra sólo si no hay una operación en curso (mismo criterio que antes en Inventario). */
function crearCerrar(loading: boolean, onClose: () => void) {
    return () => {
        if (loading) return
        onClose()
    }
}

export function ModalEliminarProductos({
    open, onClose, loading, error, productos, seleccionados, onToggleAll, onToggle, onConfirm,
}: BaseProps & { onConfirm: () => void }) {
    const cerrar = crearCerrar(loading, onClose)
    return (
            <BulkActionDialog
                open={open}
                onClose={cerrar}
                title="Eliminar productos"
                description={`Seleccioná los productos a eliminar (${seleccionados.size} seleccionado(s)). Esta acción no se puede deshacer.`}
                loading={loading}
                error={error}
                testId="bulk-delete-productos"
                footer={
                    <>
                        <button
                            type="button"
                            onClick={cerrar}
                            disabled={loading}
                            className="btn-ghost flex-1 sm:flex-none px-4 py-3 rounded-xl"
                            data-testid="bulk-delete-productos-cancel"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={() => onConfirm()}
                            disabled={loading || seleccionados.size === 0}
                            className="flex-1 sm:flex-none px-4 py-3 rounded-xl font-bold text-sm bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800 disabled:opacity-50"
                            data-testid="bulk-delete-productos-confirm"
                        >
                            {loading
                                ? 'Eliminando…'
                                : `Eliminar ${seleccionados.size} producto(s)`}
                        </button>
                    </>
                }
            >
                <BulkSelectList
                    testId="bulk-delete-productos-list"
                    allSelected={
                        productos.length > 0 &&
                        seleccionados.size === productos.length
                    }
                    onToggleAll={onToggleAll}
                    emptyMessage="No hay productos con los filtros actuales."
                    items={productos.map((producto) => ({
                        id: producto.id,
                        label: producto.name,
                        meta: `${producto.categories?.name ?? 'Sin categoría'} · $${producto.sale_price.toLocaleString()}`,
                        selected: seleccionados.has(producto.id),
                        onToggle: () => onToggle(producto.id),
                    }))}
                />
            </BulkActionDialog>
    )
}

export function ModalBadgeProductos({
    open, onClose, loading, error, productos, seleccionados, onToggleAll, onToggle, onConfirm, badge, onBadgeChange,
}: BaseProps & {
    onConfirm: () => void
    badge: CatalogBadgeKey | 'auto'
    onBadgeChange: (badge: CatalogBadgeKey | 'auto') => void
}) {
    const cerrar = crearCerrar(loading, onClose)
    return (
            <BulkActionDialog
                open={open}
                onClose={cerrar}
                title="Badges del catálogo"
                description={`Elegí el badge y los productos (${seleccionados.size} seleccionado(s)). "Automático" quita el badge fijo.`}
                loading={loading}
                error={error}
                testId="bulk-badge-productos"
                footer={
                    <>
                        <button
                            type="button"
                            onClick={cerrar}
                            disabled={loading}
                            className="btn-ghost flex-1 sm:flex-none px-4 py-3 rounded-xl"
                            data-testid="bulk-badge-productos-cancel"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={() => onConfirm()}
                            disabled={loading || seleccionados.size === 0}
                            className="flex-1 sm:flex-none px-4 py-3 rounded-xl font-bold text-sm bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-600 dark:text-white border border-violet-200 disabled:opacity-50"
                            data-testid="bulk-badge-productos-confirm"
                        >
                            {loading
                                ? 'Guardando…'
                                : `Aplicar a ${seleccionados.size} producto(s)`}
                        </button>
                    </>
                }
            >
                <div className="mb-4">
                    <label
                        htmlFor="bulk-badge-select"
                        className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5"
                    >
                        Badge a aplicar
                    </label>
                    <select
                        id="bulk-badge-select"
                        value={badge}
                        onChange={(e) =>
                            onBadgeChange(e.target.value as CatalogBadgeKey | 'auto')
                        }
                        disabled={loading}
                        className="w-full rounded-xl border border-pink-100 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm font-medium text-gray-800 dark:text-gray-100"
                        data-dialog-initial-focus
                    >
                        {CATALOG_BADGE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                        {CATALOG_BADGE_OPTIONS.find((o) => o.value === badge)?.hint}
                    </p>
                </div>
                <BulkSelectList
                    testId="bulk-badge-productos-list"
                    accent="violet"
                    allSelected={
                        productos.length > 0 &&
                        seleccionados.size === productos.length
                    }
                    onToggleAll={onToggleAll}
                    emptyMessage="No hay productos con los filtros actuales."
                    items={productos.map((producto) => ({
                        id: producto.id,
                        label: producto.name,
                        meta: etiquetaBadgeCatalogo(producto.catalog_badge),
                        selected: seleccionados.has(producto.id),
                        onToggle: () => onToggle(producto.id),
                    }))}
                />
            </BulkActionDialog>
    )
}

export function ModalVisibilidadProductos({
    open, onClose, loading, error, productos, seleccionados, onToggleAll, onToggle, onConfirm,
}: BaseProps & { onConfirm: (visible: boolean) => void }) {
    const cerrar = crearCerrar(loading, onClose)
    return (
            <BulkActionDialog
                open={open}
                onClose={cerrar}
                title="Visibilidad en catálogo"
                description={`Seleccioná productos (${seleccionados.size} seleccionado(s)) y elegí ocultar o mostrar en el catálogo público.`}
                loading={loading}
                error={error}
                testId="bulk-visibilidad-productos"
                footer={
                    <>
                        <button
                            type="button"
                            onClick={cerrar}
                            disabled={loading}
                            className="btn-ghost flex-1 sm:flex-none px-4 py-3 rounded-xl"
                            data-testid="bulk-visibilidad-productos-cancel"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={() => onConfirm(false)}
                            disabled={loading || seleccionados.size === 0}
                            className="inline-flex items-center justify-center gap-2 flex-1 sm:flex-none px-4 py-3 rounded-xl font-bold text-sm bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 disabled:opacity-50"
                            data-testid="bulk-visibilidad-productos-hide"
                        >
                            <EyeOff className="w-4 h-4" aria-hidden />
                            Ocultar ({seleccionados.size})
                        </button>
                        <button
                            type="button"
                            onClick={() => onConfirm(true)}
                            disabled={loading || seleccionados.size === 0}
                            className="inline-flex items-center justify-center gap-2 flex-1 sm:flex-none px-4 py-3 rounded-xl font-bold text-sm bg-pink-50 text-pink-600 dark:bg-pink-600 dark:text-white border border-pink-200 disabled:opacity-50"
                            data-testid="bulk-visibilidad-productos-show"
                        >
                            <Eye className="w-4 h-4" aria-hidden />
                            Mostrar ({seleccionados.size})
                        </button>
                    </>
                }
            >
                <BulkSelectList
                    testId="bulk-visibilidad-productos-list"
                    allSelected={
                        productos.length > 0 &&
                        seleccionados.size === productos.length
                    }
                    onToggleAll={onToggleAll}
                    emptyMessage="No hay productos con los filtros actuales."
                    items={productos.map((producto) => ({
                        id: producto.id,
                        label: producto.name,
                        meta: producto.visible_in_catalog === false ? 'Oculto' : 'Visible',
                        selected: seleccionados.has(producto.id),
                        onToggle: () => onToggle(producto.id),
                    }))}
                />
            </BulkActionDialog>
    )
}
