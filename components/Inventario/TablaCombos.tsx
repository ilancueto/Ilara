'use client'

import { ComboConItems } from '@/lib/supabase'
import { Pencil, Trash2, Package } from 'lucide-react'
import { PastelCard } from '@/components/ui/PastelCard'

interface TablaCombosProps {
    combos: ComboConItems[]
    loading: boolean
    onEdit: (combo: ComboConItems) => void
    onDelete: (id: number) => void
}

export default function TablaCombos({ combos, loading, onEdit, onDelete }: TablaCombosProps) {
    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-40 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
                ))}
            </div>
        )
    }
    if (combos.length === 0) {
        return (
            <PastelCard noHover className="p-10 sm:p-12 text-center">
                <Package className="w-14 h-14 text-pink-200 dark:text-pink-500/50 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400 font-medium">No hay combos creados</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Creá tu primer combo para destacarlo en el catálogo</p>
            </PastelCard>
        )
    }
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
            {combos.map(combo => (
                <PastelCard key={combo.id} noHover className="p-5 sm:p-6 flex flex-col gap-4">
                    <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-gray-900 dark:text-gray-100 text-base leading-tight">{combo.name}</h4>
                            <p className="text-xl font-extrabold text-pink-600 dark:text-pink-400 mt-1.5">${combo.sale_price.toLocaleString()}</p>
                        </div>
                        <span className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide ${combo.is_active ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                            {combo.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                    </div>
                    {combo.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">{combo.description}</p>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                        {(combo.combo_items || []).length} producto(s) en el combo
                    </p>
                    <div className="mt-auto flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-700/80">
                        <button
                            onClick={() => onEdit(combo)}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-pink-50 dark:bg-pink-900/40 text-pink-600 dark:text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-900/60 font-semibold text-sm border border-pink-100 dark:border-pink-800/50 transition-colors"
                        >
                            <Pencil className="w-4 h-4" /> Editar
                        </button>
                        <button
                            onClick={() => onDelete(combo.id)}
                            className="flex items-center justify-center p-3 rounded-xl text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors shrink-0"
                            aria-label="Eliminar combo"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </PastelCard>
            ))}
        </div>
    )
}
