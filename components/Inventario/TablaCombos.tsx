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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
                ))}
            </div>
        )
    }
    if (combos.length === 0) {
        return (
            <PastelCard noHover className="p-16 text-center">
                <Package className="w-16 h-16 text-pink-200 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">No hay combos creados</p>
                <p className="text-sm text-gray-400 mt-1">Creá tu primer combo para destacarlo en el catálogo</p>
            </PastelCard>
        )
    }
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {combos.map(combo => (
                <PastelCard key={combo.id} noHover className="p-6 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h4 className="font-bold text-gray-900">{combo.name}</h4>
                            <p className="text-2xl font-extrabold text-pink-600 mt-1">${combo.sale_price.toLocaleString()}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${combo.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            {combo.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                    </div>
                    {combo.description && (
                        <p className="text-sm text-gray-500 mb-4 line-clamp-2">{combo.description}</p>
                    )}
                    <div className="text-xs text-gray-400 mb-4">
                        {(combo.combo_items || []).length} producto(s) en el combo
                    </div>
                    <div className="mt-auto flex gap-2">
                        <button
                            onClick={() => onEdit(combo)}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-pink-50 text-pink-600 hover:bg-pink-100 font-semibold text-sm"
                        >
                            <Pencil className="w-4 h-4" /> Editar
                        </button>
                        <button
                            onClick={() => onDelete(combo.id)}
                            className="p-2.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50"
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
