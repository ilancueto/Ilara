'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { createPortal } from 'react-dom'
import { Income, IncomeFormData, IncomeType, INCOME_TYPE_LABELS, PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/types'
import { getIncomes, createIncome, updateIncome, deleteIncome } from '@/lib/incomeService'
import { Plus, TrendingUp, Pencil, Trash2, X, Filter, History, Wallet, Scale } from 'lucide-react'
import { PastelCard } from '@/components/ui/PastelCard'
import { useToast } from '@/context/ToastContext'
import HistorialVentas from '@/components/HistorialVentas'
import { useConfirm } from '@/hooks/useConfirm'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

const TYPE_ICONS: Record<IncomeType, string> = {
  regalo: '🎁',
  donacion: '❤️',
  ventas_anteriores: '📋',
  otro: '💰',
}

const TYPE_SHORT_LABELS: Record<IncomeType, string> = {
  regalo: 'Regalo',
  donacion: 'Donación',
  ventas_anteriores: 'V. anteriores',
  otro: 'Otro',
}

const FinanceLedger = dynamic(() => import('@/components/FinanceLedger'), {
  loading: () => <div className="h-72 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />,
})

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

export default function Ingresos() {
  const { showSuccess, showError } = useToast()
  const { confirm, confirmProps } = useConfirm()
  const [vistaActiva, setVistaActiva] = useState<'otros' | 'historial' | 'finanzas'>('historial')
  const [incomes, setIncomes] = useState<Income[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Income | null>(null)
  const [saving, setSaving] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [typeFilter, setTypeFilter] = useState<IncomeType | ''>('')

  const [form, setForm] = useState<IncomeFormData>({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    type: 'otro',
    description: '',
    notes: '',
    payment_method: 'otro',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getIncomes({
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
        ...(typeFilter && { type: typeFilter as IncomeType }),
      })
      setIncomes(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al cargar ingresos'
      showError(msg)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, typeFilter, showError])

  useEffect(() => { load() }, [load])

  const openNew = () => {
    setEditing(null)
    setForm({
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      type: 'otro',
      description: '',
      notes: '',
      payment_method: 'otro',
    })
    setModalOpen(true)
  }

  const openEdit = (income: Income) => {
    setEditing(income)
    setForm({
      date: income.date,
      amount: income.amount,
      type: income.type,
      description: income.description || '',
      notes: income.notes || '',
      payment_method: income.payment_method,
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.amount <= 0) {
      showError('El monto debe ser mayor a 0')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateIncome(editing.id, form)
        showSuccess('Ingreso actualizado')
      } else {
        await createIncome(form)
        showSuccess('Ingreso registrado')
      }
      setModalOpen(false)
      load()
    } catch {
      showError(editing ? 'Error al actualizar' : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: '¿Eliminar este ingreso?',
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteIncome(id)
      showSuccess('Ingreso eliminado')
      load()
    } catch {
      showError('Error al eliminar')
    }
  }

  const total = incomes.reduce((sum, i) => sum + i.amount, 0)

  return (
    <div className="flex flex-col gap-10 sm:gap-12 animate-fade-in pb-14 px-4 sm:px-6 lg:px-8">
      {/* Header + sub-nav fijos al hacer scroll */}
      <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-4 pb-6 -mt-2 bg-[#f6f2f7]/90 dark:bg-zinc-950/95 backdrop-blur-md border-b border-pink-100/60 dark:border-white/10">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800 dark:text-gray-100 tracking-tight flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-200/60 dark:shadow-emerald-900/40">✦</span>
                Cuentas y caja
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium max-w-md mt-2">Mostrador, pedidos online y combinado. Los cobros web no se mezclan con la caja del local.</p>
            </div>
            <button type="button" onClick={openNew} className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-200/50 hover:shadow-xl hover:shadow-emerald-300/40 hover:-translate-y-0.5 transition-all duration-200 shrink-0">
              <Plus size={20} />
              Nuevo ingreso
            </button>
          </div>

          {/* Sub navegación: Ventas | Otros ingresos */}
          <div className="flex justify-center">
            <PastelCard className="!p-2 flex gap-1 rounded-2xl w-auto inline-flex shadow-md shadow-emerald-100/50 dark:shadow-none border border-gray-200 dark:border-gray-700" noHover>
              <button
                onClick={() => setVistaActiva('historial')}
                className={`
                  flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300
                  ${vistaActiva === 'historial'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-300/40 dark:shadow-emerald-900/40'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-emerald-50/60 dark:hover:bg-emerald-900/30'
                  }
                `}
              >
                <History className="w-4 h-4" strokeWidth={2.5} />
                Ventas
              </button>
              <button
                onClick={() => setVistaActiva('otros')}
                className={`
                  flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-300
                  ${vistaActiva === 'otros'
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }
                `}
              >
                <Wallet className="w-4 h-4" strokeWidth={2.5} />
                Otros ingresos
              </button>
              <button
                onClick={() => setVistaActiva('finanzas')}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${vistaActiva === 'finanzas'
                  ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Scale className="w-4 h-4" strokeWidth={2.5} />
                Cuentas y caja
              </button>
            </PastelCard>
          </div>
        </div>
      </div>

      {vistaActiva === 'historial' ? (
        <HistorialVentas onOpenFinance={() => setVistaActiva('finanzas')} />
      ) : vistaActiva === 'finanzas' ? (
        <FinanceLedger />
      ) : (
        <div className="flex flex-col gap-8">
          {/* Filtros: barra compacta en una fila (desktop) */}
          <PastelCard className="p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-gray-600" noHover>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-4">
              <div className="flex items-center gap-2 shrink-0">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                  <Filter size={14} />
                </span>
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Filtros</span>
              </div>
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 flex-1 min-w-0">
                <label className="flex flex-col gap-1 shrink-0 sm:w-[160px]">
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Desde</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="form-input w-full rounded-lg h-10 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 min-w-0"
                    aria-label="Fecha desde"
                  />
                </label>
                <label className="flex flex-col gap-1 shrink-0 sm:w-[160px]">
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Hasta</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="form-input w-full rounded-lg h-10 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 min-w-0"
                    aria-label="Fecha hasta"
                  />
                </label>
                <label className="flex flex-col gap-1 shrink-0 sm:w-[180px] min-w-0">
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Tipo</span>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as IncomeType | '')}
                    className="otros-ingresos-filtros-select form-input w-full rounded-lg h-10 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 pr-8 appearance-none cursor-pointer min-w-0"
                  >
                    <option value="">Todos los tipos</option>
                    {(Object.keys(INCOME_TYPE_LABELS) as IncomeType[]).map((t) => (
                      <option key={t} value={t}>{INCOME_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </PastelCard>

          {/* Total en el período: más compacto y elegante */}
          {incomes.length > 0 && (
            <div className="flex items-center gap-5 p-5 sm:p-6 rounded-2xl bg-emerald-50/80 dark:bg-emerald-900/20 border border-emerald-100/80 dark:border-emerald-800/40">
              <div className="w-12 h-12 rounded-xl bg-emerald-100/80 dark:bg-emerald-800/40 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Total en el período</p>
                <p className="text-xl sm:text-2xl font-bold text-emerald-800 dark:text-emerald-100 tabular-nums mt-0.5">{formatCurrency(total)}</p>
              </div>
            </div>
          )}

          {/* Movimientos: más jerarquía */}
          <div className="flex flex-col gap-6">
            <div className="flex items-baseline gap-3">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Movimientos</h2>
              <span className="text-sm font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700/80 px-2.5 py-0.5 rounded-lg tabular-nums">{incomes.length}</span>
            </div>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800/60 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : incomes.length === 0 ? (
              <PastelCard className="p-12 sm:p-14 text-center rounded-2xl" noHover>
                <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-800/50 flex items-center justify-center text-2xl mb-4">💰</div>
                <p className="font-semibold text-gray-800 dark:text-gray-100 text-base">No hay ingresos registrados</p>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-2 max-w-sm mx-auto">Agregá regalos, donaciones, ventas anteriores al sistema o cualquier otro ingreso extra.</p>
                <button type="button" onClick={openNew} className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-emerald-600 dark:text-emerald-400 font-semibold rounded-xl border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-800/50 transition-colors">
                  <Plus size={18} />
                  Nuevo ingreso
                </button>
              </PastelCard>
            ) : (
              <ul className="space-y-4">
                {incomes.map((income) => (
                  <li key={income.id}>
                    <PastelCard className="p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-gray-600 flex flex-col sm:flex-row sm:items-center justify-between gap-5 group hover:border-emerald-200/80 dark:hover:border-emerald-700/50 transition-colors overflow-hidden">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100/80 dark:border-emerald-800/40 flex items-center justify-center text-xl flex-shrink-0">
                          {TYPE_ICONS[income.type]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base line-clamp-2">{income.description || INCOME_TYPE_LABELS[income.type]}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {INCOME_TYPE_LABELS[income.type]} · {formatDate(income.date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-4 pl-14 sm:pl-0">
                        <span className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(income.amount)}</span>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => openEdit(income)} className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 transition-colors" aria-label="Editar">
                            <Pencil size={16} />
                          </button>
                          <button type="button" onClick={() => handleDelete(income.id)} className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" aria-label="Eliminar">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </PastelCard>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      )}

      {/* Modal Nuevo/Editar ingreso */}
      {modalOpen && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm z-[200] animate-fade-in" onClick={() => setModalOpen(false)} aria-hidden />
          <PastelCard noHover className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-lg max-h-[90vh] overflow-hidden flex flex-col z-[201] shadow-2xl rounded-3xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between flex-shrink-0 p-6 sm:p-8 pb-4">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2.5">
                <span className="text-2xl">{editing ? '✏️' : '➕'}</span>
                {editing ? 'Editar ingreso' : 'Nuevo ingreso'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="p-2.5 rounded-xl text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto px-6 sm:px-8 pb-6 flex flex-col gap-7">
                {/* Fecha y monto */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="form-label text-sm">Fecha <span className="text-emerald-500">*</span></label>
                    <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className="form-input w-full rounded-xl" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="form-label text-sm">Monto <span className="text-emerald-500">*</span></label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={form.amount || ''}
                        onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                        required
                        className="form-input w-full pr-10 rounded-xl"
                        placeholder="0"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold pointer-events-none">$</span>
                    </div>
                  </div>
                </div>

                {/* Tipo de ingreso */}
                <div className="flex flex-col gap-3">
                  <label className="form-label text-sm">Tipo de ingreso</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(Object.keys(INCOME_TYPE_LABELS) as IncomeType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm({ ...form, type: t })}
                        className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all min-h-[88px]
                          ${form.type === t
                            ? 'bg-emerald-50 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-700'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-emerald-100 dark:hover:border-emerald-800 hover:text-gray-700 dark:hover:text-gray-200'
                          }`}
                      >
                        <span className={`text-2xl ${form.type === t ? 'scale-105' : ''}`}>{TYPE_ICONS[t]}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-center leading-tight">{TYPE_SHORT_LABELS[t]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Descripción */}
                <div className="flex flex-col gap-2">
                  <label className="form-label text-sm">Medio de ingreso</label>
                  <select
                    value={form.payment_method}
                    onChange={(e) => setForm({ ...form, payment_method: e.target.value as PaymentMethod })}
                    className="form-input w-full rounded-xl"
                  >
                    {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => (
                      <option key={method} value={method}>{PAYMENT_METHOD_LABELS[method]}</option>
                    ))}
                  </select>
                </div>

                {/* Descripción */}
                <div className="flex flex-col gap-2">
                  <label className="form-label text-sm">Descripción</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="form-input w-full rounded-xl"
                    placeholder="Ej. Regalo de proveedor, donación de cliente..."
                  />
                </div>

                {/* Notas */}
                <div className="flex flex-col gap-2">
                  <label className="form-label text-sm">Notas (opcional)</label>
                  <textarea
                    value={form.notes || ''}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="form-input w-full rounded-xl resize-none"
                    rows={3}
                    placeholder="Información adicional..."
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex-shrink-0 p-6 sm:p-8 pt-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40 flex gap-4">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost flex-1 py-3 rounded-xl text-gray-600 dark:text-gray-300">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-[2] inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-200/50 hover:shadow-emerald-300/50 hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:hover:translate-y-0">
                  {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </PastelCard>
        </>,
        document.body
      )}
      <ConfirmDialog {...confirmProps} testId="confirm-ingreso" />
    </div>
  )
}
