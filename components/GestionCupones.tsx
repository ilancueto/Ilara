'use client'

import { useState, useEffect } from 'react'
import { supabase, Cupon } from '@/lib/supabase'
import { X, Plus, Trash2, Tag } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import { PastelCard } from '@/components/ui/PastelCard'

interface Props {
    mostrar: boolean
    cerrar: () => void
}

export default function GestionCupones({ mostrar, cerrar }: Props) {
    const { showSuccess, showError } = useToast()
    const [cupones, setCupones] = useState<Cupon[]>([])
    const [codigo, setCodigo] = useState('')
    const [porcentaje, setPorcentaje] = useState('')
    const [cargando, setCargando] = useState(false)

    useEffect(() => {
        if (mostrar) {
            obtenerCupones()
        }
    }, [mostrar])

    const obtenerCupones = async () => {
        const { data, error } = await supabase
            .from('coupons')
            .select('*')
            .order('created_at', { ascending: false })
        if (!error && data) setCupones(data)
    }

    const codigoNormalizado = (c: string) => c.trim().toUpperCase()

    const handleCrear = async () => {
        const code = codigoNormalizado(codigo)
        if (!code) {
            showError('Escribí el código del cupón')
            return
        }
        const pct = parseInt(porcentaje, 10)
        if (isNaN(pct) || pct < 0 || pct > 100) {
            showError('El descuento debe ser entre 0 y 100')
            return
        }

        setCargando(true)
        const { error } = await supabase
            .from('coupons')
            .insert([{ code, discount_percentage: pct, is_active: true }])

        if (!error) {
            showSuccess('Cupón creado correctamente')
            setCodigo('')
            setPorcentaje('')
            await obtenerCupones()
        } else {
            showError(error.code === '23505' ? 'Ese código de cupón ya existe' : 'Error al crear el cupón')
        }
        setCargando(false)
    }

    const handleToggleActivo = async (c: Cupon) => {
        setCargando(true)
        const { error } = await supabase
            .from('coupons')
            .update({ is_active: !c.is_active })
            .eq('id', c.id)
        if (!error) {
            showSuccess(c.is_active ? 'Cupón desactivado' : 'Cupón activado')
            await obtenerCupones()
        } else {
            showError('Error al actualizar')
        }
        setCargando(false)
    }

    const handleEliminar = async (id: number) => {
        if (!confirm('¿Eliminar este cupón?')) return
        setCargando(true)
        const { error } = await supabase.from('coupons').delete().eq('id', id)
        if (!error) {
            showSuccess('Cupón eliminado')
            await obtenerCupones()
        } else {
            showError('Error al eliminar')
        }
        setCargando(false)
    }

    if (!mostrar) return null

    return (
        <>
            <div className="modal-backdrop" onClick={cerrar} />
            <PastelCard className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col z-[100] !shadow-2xl" noHover>
                <div className="p-6 border-b border-pink-100 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Tag className="w-6 h-6 text-pink-500" />
                        <h3 className="text-xl font-bold text-gray-800">Cupones del catálogo</h3>
                    </div>
                    <button onClick={cerrar} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-700">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 min-h-0 space-y-6">
                    <p className="text-sm text-gray-500">
                        Los clientes pueden ingresar el código en el catálogo para obtener un descuento sobre el total del pedido.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <input
                            type="text"
                            value={codigo}
                            onChange={(e) => setCodigo(e.target.value)}
                            placeholder="Código (ej: VERANO10)"
                            className="form-input flex-1 min-w-0 sm:min-w-[200px]"
                        />
                        <div className="w-24 flex-shrink-0">
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={porcentaje}
                                onChange={(e) => setPorcentaje(e.target.value)}
                                placeholder="%"
                                className="form-input w-full"
                            />
                        </div>
                        <button
                            onClick={handleCrear}
                            disabled={cargando}
                            className="btn-primary whitespace-nowrap"
                        >
                            <Plus className="w-4 h-4" /> Agregar
                        </button>
                    </div>
                    <div className="space-y-2">
                        {cupones.length === 0 ? (
                            <p className="text-gray-400 text-sm py-4">No hay cupones. Agregá uno arriba.</p>
                        ) : (
                            cupones.map((c) => (
                                <div
                                    key={c.id}
                                    className={`flex items-center justify-between gap-4 p-4 rounded-xl border transition-colors ${c.is_active ? 'bg-white border-pink-100' : 'bg-gray-50 border-gray-200 opacity-75'}`}
                                >
                                    <div>
                                        <span className="font-bold text-gray-800">{c.code}</span>
                                        <span className="text-pink-600 font-semibold ml-2">-{c.discount_percentage}%</span>
                                        {!c.is_active && <span className="text-xs text-gray-400 ml-2">(inactivo)</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleToggleActivo(c)}
                                            disabled={cargando}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${c.is_active ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                                        >
                                            {c.is_active ? 'Desactivar' : 'Activar'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleEliminar(c.id)}
                                            disabled={cargando}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </PastelCard>
        </>
    )
}
