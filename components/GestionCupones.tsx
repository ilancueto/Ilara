'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, Cupon } from '@/lib/supabase'
import { X, Plus, Trash2, Tag } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import { PastelCard } from '@/components/ui/PastelCard'
import { useConfirm } from '@/hooks/useConfirm'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface Props {
    mostrar: boolean
    cerrar: () => void
}

export default function GestionCupones({ mostrar, cerrar }: Props) {
    const { showSuccess, showError } = useToast()
    const { confirm, confirmProps } = useConfirm()
    const [cupones, setCupones] = useState<Cupon[]>([])
    const [codigo, setCodigo] = useState('')
    const [porcentaje, setPorcentaje] = useState('')
    const [cargando, setCargando] = useState(false)

    const obtenerCupones = useCallback(async () => {
        const { data, error } = await supabase
            .from('coupons')
            .select('*')
            .order('created_at', { ascending: false })
        if (!error && data) setCupones(data)
    }, [])

    /* eslint-disable react-hooks/set-state-in-effect -- load coupons when modal opens */
    useEffect(() => {
        if (mostrar) {
            obtenerCupones()
        }
    }, [mostrar, obtenerCupones])
    /* eslint-enable react-hooks/set-state-in-effect */

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
        const ok = await confirm({
            title: '¿Eliminar este cupón?',
            confirmLabel: 'Eliminar',
            danger: true,
        })
        if (!ok) return
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
            <PastelCard className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col z-[100] !shadow-2xl rounded-3xl border border-line" noHover>
                <div className="p-5 sm:p-6 border-b border-line flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Tag className="w-6 h-6 text-accent" />
                        <h3 className="text-xl font-bold text-ink">Cupones del catálogo</h3>
                    </div>
                    <button onClick={cerrar} className="p-2 rounded-xl hover:bg-surface-soft text-muted hover:text-ink" aria-label="Cerrar">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-5 sm:p-6 overflow-y-auto flex-1 min-h-0 flex flex-col gap-4">
                    <p className="text-sm text-muted leading-snug">
                        Los clientes pueden ingresar el código en el catálogo para obtener un descuento sobre el total del pedido.
                    </p>
                    <div className="flex flex-col gap-2">
                        <label className="form-label text-xs">Nuevo cupón</label>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <input
                                type="text"
                                value={codigo}
                                onChange={(e) => setCodigo(e.target.value)}
                                placeholder="Código (ej: VERANO10)"
                                className="form-input form-control-h flex-1 min-w-0 sm:min-w-[180px]"
                            />
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={porcentaje}
                                onChange={(e) => setPorcentaje(e.target.value)}
                                placeholder="%"
                                className="form-input form-control-h w-20 flex-shrink-0"
                            />
                            <button
                                onClick={handleCrear}
                                disabled={cargando}
                                className="btn-primary form-control-h whitespace-nowrap gap-2 px-4"
                            >
                                <Plus className="w-4 h-4" /> Agregar
                            </button>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        {cupones.length === 0 ? (
                            <p className="text-hint text-sm py-3">No hay cupones. Agregá uno arriba.</p>
                        ) : (
                            cupones.map((c) => (
                                <div
                                    key={c.id}
                                    className={`flex items-center justify-between gap-4 p-3 sm:p-4 rounded-xl border transition-colors ${c.is_active ? 'bg-surface border-line' : 'bg-gray-50 dark:bg-gray-800/50 border-line opacity-75'}`}
                                >
                                    <div>
                                        <span className="font-bold text-ink">{c.code}</span>
                                        <span className="text-accent font-semibold ml-2">-{c.discount_percentage}%</span>
                                        {!c.is_active && <span className="text-xs text-hint ml-2">(inactivo)</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleToggleActivo(c)}
                                            disabled={cargando}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${c.is_active ? 'bg-warning-soft text-warning hover:bg-warning-soft' : 'bg-success-soft text-success hover:bg-success-soft'}`}
                                        >
                                            {c.is_active ? 'Desactivar' : 'Activar'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleEliminar(c.id)}
                                            disabled={cargando}
                                            className="p-2 text-hint hover:text-danger hover:bg-danger-soft rounded-lg"
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
            <ConfirmDialog {...confirmProps} testId="confirm-cupon" />
        </>
    )
}
