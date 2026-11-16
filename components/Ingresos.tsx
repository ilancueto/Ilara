'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
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
  loading: () => <div className="h-72 rounded-2xl bg-surface-soft animate-pulse" />,
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
  const searchParams = useSearchParams()
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

  useEffect(() => {
    const view = searchParams.get('view')
    if (view === 'historial' || view === 'finanzas' || view === 'otros') {
      setVistaActiva(view)
    }
  }, [searchParams])

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
      <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-4 pb-6 -mt-2 bg-canvas/90 backdrop-blur-md border-b border-pink-100/60 dark:border-white/10">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary hover:bg-primary-hover text-white">✦</span>
                Cuentas y caja
              </h1>
              <p className="text-muted text-sm font-medium max-w-md mt-2">Mostrador, pedidos online y combinado. Los cobros web no se mezclan con la caja del local.</p>
            </div>
            <button type="button" onClick={openNew} className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-primary hover:bg-primary-hover text-white font-semibold rounded-full hover:-translate-y-0.5 transition-all duration-200 shrink-0">
              <Plus size={20} />
              Nuevo ingreso
            </button>
          </div>

          {/* Sub navegación: Ventas | Otros ingresos */}
          <div className="flex justify-center">
            <PastelCard className="!p-2 flex gap-1 rounded-2xl w-auto inline-flex border border-line" noHover>
              <button
                onClick={() => setVistaActiva('historial')}
                className={`
                  flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300
                  ${vistaActiva === 'historial'
                    ? 'bg-primary hover:bg-primary-hover text-white'
                    : 'text-muted hover:text-ink hover:bg-surface-soft'
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
                    ? 'bg-primary-soft text-primary-ink border border-primary'
                    : 'text-hint hover:text-muted hover:bg-canvas'
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
                  : 'text-hint hover:text-muted hover:bg-canvas'
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
          <PastelCard className="p-4 sm:p-5 rounded-xl border border-line" noHover>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-4">
              <div className="flex items-center gap-2 shrink-0">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-success-soft text-success">
                  <Filter size={14} />
                </span>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Filtros</span>
              </div>
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 flex-1 min-w-0">
                <label className="flex flex-col gap-1 shrink-0 sm:w-[160px]">
                  <span className="text-[11px] font-medium text-muted">Desde</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="form-input w-full rounded-lg h-10 text-sm border border-line bg-surface px-3 py-2 min-w-0"
                    aria-label="Fecha desde"
                  />
                </label>
                <label className="flex flex-col gap-1 shrink-0 sm:w-[160px]">
                  <span className="text-[11px] font-medium text-muted">Hasta</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="form-input w-full rounded-lg h-10 text-sm border border-line bg-surface px-3 py-2 min-w-0"
                    aria-label="Fecha hasta"
                  />
                </label>
                <label className="flex flex-col gap-1 shrink-0 sm:w-[180px] min-w-0">
                  <span className="text-[11px] font-medium text-muted">Tipo</span>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as IncomeType | '')}
                    className="otros-ingresos-filtros-select form-input w-full rounded-lg h-10 text-sm border border-line bg-surface px-3 py-2 pr-8 appearance-none cursor-pointer min-w-0"
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
            <div className="flex items-center gap-5 p-5 sm:p-6 rounded-2xl bg-success-soft border border-success-line">
              <div className="w-12 h-12 rounded-xl bg-success-soft flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-6 h-6 text-success" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-success uppercase tracking-wider">Total en el período</p>
                <p className="text-xl sm:text-2xl font-bold text-emerald-800 dark:text-emerald-100 tabular-nums mt-0.5">{formatCurrency(total)}</p>
              </div>
            </div>
          )}

          {/* Movimientos: más jerarquía */}
          <div className="flex flex-col gap-6">
            <div className="flex items-baseline gap-3">
              <h2 className="text-lg font-bold text-ink">Movimientos</h2>
              <span className="text-sm font-medium text-hint bg-gray-100 dark:bg-gray-700/80 px-2.5 py-0.5 rounded-lg tabular-nums">{incomes.length}</span>
            </div>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800/60 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : incomes.length === 0 ? (
              <PastelCard className="p-12 sm:p-14 text-center rounded-2xl" noHover>
                <div className="w-14 h-14 mx-auto rounded-2xl bg-success-soft flex items-center justify-center text-2xl mb-4">💰</div>
                <p className="font-semibold text-ink text-base">No hay ingresos registrados</p>
                <p className="text-muted text-sm mt-2 max-w-sm mx-auto">Agregá regalos, donaciones, ventas anteriores al sistema o cualquier otro ingreso extra.</p>
                <button type="button" onClick={openNew} className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-success font-semibold rounded-xl border border-success-line bg-success-soft hover:bg-success-soft transition-colors">
                  <Plus size={18} />
                  Nuevo ingreso
                </button>
              </PastelCard>
            ) : (
              <ul className="space-y-4">
                {incomes.map((income) => (
                  <li key={income.id}>
                    <PastelCard className="p-5 sm:p-6 rounded-2xl border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-5 group hover:border-success-line transition-colors overflow-hidden">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="w-11 h-11 rounded-xl bg-success-soft border border-success-line flex items-center justify-center text-xl flex-shrink-0">
                          {TYPE_ICONS[income.type]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-ink text-sm sm:text-base line-clamp-2">{income.description || INCOME_TYPE_LABELS[income.type]}</p>
                          <p className="text-xs text-muted mt-1">
                            {INCOME_TYPE_LABELS[income.type]} · {formatDate(income.date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-4 pl-14 sm:pl-0">
                        <span className="text-lg sm:text-xl font-bold text-success tabular-nums">{formatCurrency(income.amount)}</span>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => openEdit(income)} className="p-2 rounded-lg text-hint hover:text-success hover:bg-success-soft transition-colors" aria-label="Editar">
                            <Pencil size={16} />
                          </button>
                          <button type="button" onClick={() => handleDelete(income.id)} className="p-2 rounded-lg text-hint hover:text-danger hover:bg-danger-soft transition-colors" aria-label="Eliminar">
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
          <PastelCard noHover className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-lg max-h-[90vh] overflow-hidden flex flex-col z-[201] shadow-2xl rounded-3xl border border-line">
            <div className="flex items-center justify-between flex-shrink-0 p-6 sm:p-8 pb-4">
              <h3 className="text-xl font-bold text-ink flex items-center gap-2.5">
                <span className="text-2xl">{editing ? '✏️' : '➕'}</span>
                {editing ? 'Editar ingreso' : 'Nuevo ingreso'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="p-2.5 rounded-xl text-hint hover:text-gray-600 dark:hover:text-gray-200 hover:bg-surface-soft transition-colors" aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto px-6 sm:px-8 pb-6 flex flex-col gap-7">
                {/* Fecha y monto */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="form-label text-sm">Fecha <span className="text-accent">*</span></label>
                    <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className="form-input w-full rounded-xl" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="form-label text-sm">Monto <span className="text-accent">*</span></label>
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
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-hint font-semibold pointer-events-none">$</span>
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
                            ? 'bg-primary-soft border-primary text-primary-ink ring-1 ring-primary'
                            : 'bg-surface border-line text-muted hover:bg-canvas hover:border-primary hover:text-ink'
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
              <div className="flex-shrink-0 p-6 sm:p-8 pt-6 border-t border-line bg-gray-50/50 dark:bg-gray-800/40 flex gap-4">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost flex-1 py-3 rounded-xl text-muted">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-[2] inline-flex items-center justify-center gap-2 px-5 py-3 bg-primary hover:bg-primary-hover text-white font-semibold rounded-full hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:hover:translate-y-0">
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
