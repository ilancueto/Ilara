'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Income, IncomeFormData, IncomeType, INCOME_TYPE_LABELS } from '@/lib/types'
import { getIncomes, createIncome, updateIncome, deleteIncome } from '@/lib/incomeService'
import { Plus, TrendingUp, Pencil, Trash2, X, Filter, History, Wallet } from 'lucide-react'
import { PastelCard } from '@/components/ui/PastelCard'
import { useToast } from '@/context/ToastContext'
import HistorialVentas from '@/components/HistorialVentas'

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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

export default function Ingresos() {
  const { showSuccess, showError } = useToast()
  const [vistaActiva, setVistaActiva] = useState<'otros' | 'historial'>('historial')
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
  })

  const load = async () => {
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
  }

  useEffect(() => { load() }, [dateFrom, dateTo, typeFilter])

  const openNew = () => {
    setEditing(null)
    setForm({
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      type: 'otro',
      description: '',
      notes: '',
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
    if (!confirm('¿Eliminar este ingreso?')) return
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
    <div className="flex flex-col gap-10 animate-fade-in pb-12">
      {/* Header + sub-nav fijos al hacer scroll para que "Nuevo ingreso" siempre esté visible */}
      <div className="sticky top-0 z-10 -mx-4 px-4 pt-2 pb-6 -mt-2 bg-[#faf9fb]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight mb-2 flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-200/60">✦</span>
              Ingresos
            </h1>
            <p className="text-gray-500 text-sm font-medium max-w-md">Ventas del negocio y otros ingresos (regalos, donaciones, etc.).</p>
          </div>
          <button type="button" onClick={openNew} className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-200/50 hover:shadow-xl hover:shadow-emerald-300/40 hover:-translate-y-0.5 transition-all duration-200 shrink-0">
            <Plus size={20} />
            Nuevo ingreso
          </button>
        </div>

        {/* Sub navegación: Ventas (principal) | Otros ingresos (secundaria) */}
        <div className="flex justify-center mt-6">
          <PastelCard className="!p-2 flex gap-1 rounded-[22px] mx-auto w-auto inline-flex shadow-md shadow-emerald-100/50" noHover>
            <button
              onClick={() => setVistaActiva('historial')}
              className={`
                flex items-center gap-2 px-6 py-3 rounded-[18px] text-sm font-bold transition-all duration-300
                ${vistaActiva === 'historial'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-300/40'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-emerald-50/60'
                }
              `}
            >
              <History className="w-4 h-4" strokeWidth={2.5} />
              Ventas
            </button>
            <button
              onClick={() => setVistaActiva('otros')}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-[14px] text-xs font-semibold transition-all duration-300
                ${vistaActiva === 'otros'
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }
              `}
            >
              <Wallet className="w-3.5 h-3.5" strokeWidth={2.5} />
              Otros ingresos
            </button>
          </PastelCard>
        </div>
      </div>

      {vistaActiva === 'historial' ? (
        <HistorialVentas />
      ) : (
        <>
      {/* Filtros */}
      <PastelCard className="p-5 sm:p-6" noHover>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <span className="flex items-center gap-2 text-sm font-bold text-gray-600 uppercase tracking-wider">
            <Filter size={16} className="text-emerald-500" />
            Filtros
          </span>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 flex-1">
            <label className="flex items-center gap-2 text-sm text-gray-500">
              <span className="hidden sm:inline">Desde</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="form-input w-auto min-w-[140px]"
                aria-label="Fecha desde"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-500">
              <span className="hidden sm:inline">Hasta</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="form-input w-auto min-w-[140px]"
                aria-label="Fecha hasta"
              />
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as IncomeType | '')}
              className="form-input w-auto min-w-[180px] bg-white"
            >
              <option value="">Todos los tipos</option>
              {(Object.keys(INCOME_TYPE_LABELS) as IncomeType[]).map((t) => (
                <option key={t} value={t}>{INCOME_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
        </div>
      </PastelCard>

      {/* Resumen total */}
      {incomes.length > 0 && (
        <div className="flex items-center gap-5 p-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100/80 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
            <TrendingUp className="w-7 h-7 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-700 uppercase tracking-wider">Total en el período</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-800 tabular-nums mt-0.5">{formatCurrency(total)}</p>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
          <span>Movimientos</span>
          <span className="text-sm font-normal text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full">{incomes.length}</span>
        </h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gradient-to-r from-white/80 to-emerald-50/30 rounded-2xl border border-emerald-100/60 animate-pulse" />
            ))}
          </div>
        ) : incomes.length === 0 ? (
          <PastelCard className="p-14 sm:p-16 text-center" noHover>
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 flex items-center justify-center text-3xl mb-4">💰</div>
            <p className="font-semibold text-gray-700 text-lg">No hay ingresos registrados</p>
            <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto">Agregá regalos, donaciones, ventas anteriores al sistema o cualquier otro ingreso extra.</p>
            <button type="button" onClick={openNew} className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-emerald-600 font-semibold rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors">
              <Plus size={18} />
              Nuevo ingreso
            </button>
          </PastelCard>
        ) : (
          <ul className="space-y-3">
            {incomes.map((income) => (
              <li key={income.id}>
                <PastelCard className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group transition-all duration-200 hover:border-emerald-200/80 overflow-hidden">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 flex items-center justify-center text-2xl shadow-sm flex-shrink-0">
                      {TYPE_ICONS[income.type]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-900 break-words line-clamp-2">{income.description || INCOME_TYPE_LABELS[income.type]}</p>
                      <p className="text-sm text-gray-500 mt-0.5 truncate">
                        {INCOME_TYPE_LABELS[income.type]} · {formatDate(income.date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pl-16 sm:pl-0">
                    <span className="text-xl font-extrabold text-emerald-700 tabular-nums">{formatCurrency(income.amount)}</span>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => openEdit(income)} className="p-2.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors" aria-label="Editar">
                        <Pencil size={18} />
                      </button>
                      <button type="button" onClick={() => handleDelete(income.id)} className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors" aria-label="Eliminar">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </PastelCard>
              </li>
            ))}
          </ul>
        )}
      </div>

        </>
      )}

      {/* Modal Nuevo/Editar — renderizado en portal para quedar centrado en viewport */}
      {modalOpen && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 bg-black/25 backdrop-blur-sm z-[200] animate-fade-in" onClick={() => setModalOpen(false)} aria-hidden />
          <PastelCard noHover className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-lg p-8 z-[201] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span className="text-2xl">{editing ? '✏️' : '➕'}</span>
                {editing ? 'Editar ingreso' : 'Nuevo ingreso'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="p-2.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Fecha y monto */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Fecha <span className="text-emerald-500">*</span></label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className="form-input w-full" />
                </div>
                <div>
                  <label className="form-label">Monto <span className="text-emerald-500">*</span></label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={form.amount || ''}
                      onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                      required
                      className="form-input w-full pr-10"
                      placeholder="0"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold pointer-events-none">$</span>
                  </div>
                </div>
              </div>

              {/* Tipo: tarjetas visuales */}
              <div>
                <label className="form-label">Tipo de ingreso</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                  {(Object.keys(INCOME_TYPE_LABELS) as IncomeType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, type: t })}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all h-20
                        ${form.type === t
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm ring-1 ring-emerald-200'
                          : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50 hover:border-emerald-100 hover:text-gray-700'
                        }`}
                    >
                      <span className={`text-2xl ${form.type === t ? 'scale-110' : ''}`}>{TYPE_ICONS[t]}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-center leading-tight">{TYPE_SHORT_LABELS[t]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Descripción y notas */}
              <div>
                <label className="form-label">Descripción</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="form-input w-full"
                  placeholder="Ej. Regalo de proveedor, donación de cliente..."
                />
              </div>
              <div>
                <label className="form-label">Notas (opcional)</label>
                <textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="form-input w-full" rows={2} placeholder="Información adicional..." />
              </div>

              {/* Botones */}
              <div className="flex gap-4 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost flex-1 border-gray-200 text-gray-600">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-200/50 hover:shadow-emerald-300/50 hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:hover:translate-y-0">
                  {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </PastelCard>
        </>,
        document.body
      )}
    </div>
  )
}
