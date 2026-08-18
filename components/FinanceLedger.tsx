'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, CalendarDays, CheckCircle2, CircleDollarSign, Plus, Scale, X } from 'lucide-react'
import { PastelCard } from '@/components/ui/PastelCard'
import { EmptyState } from '@/components/ui/EmptyState'
import Loader from '@/components/Loader'
import { useToast } from '@/context/ToastContext'
import { useConfirm } from '@/hooks/useConfirm'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cancelPayable, createPayable, getCatalogPaymentSlice, getFinanceSnapshot, recordSettlement } from '@/lib/domain/finance/browserFinance'
import type { FinancialAccount, FinancialAccountKind, FinanceSnapshot } from '@/lib/domain/finance/types'
import type { CatalogFinanceSlice } from '@/lib/domain/payments/finance'
import { paymentMethodLabel, type PaymentMethodCode } from '@/lib/domain/payments/states'
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/types'
import { panelHref } from '@/lib/appNavigation'

const METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]

const money = (value: number) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
}).format(Number(value) || 0)

function defaultPeriod() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const local = (date: Date) => {
    const offset = date.getTimezoneOffset() * 60_000
    return new Date(date.getTime() - offset).toISOString().slice(0, 10)
  }
  return { from: local(from), to: local(now) }
}

export default function FinanceLedger() {
  const { showSuccess, showError } = useToast()
  const { confirm, confirmProps } = useConfirm()
  const [period, setPeriod] = useState(defaultPeriod)
  const [snapshot, setSnapshot] = useState<FinanceSnapshot | null>(null)
  const [catalog, setCatalog] = useState<CatalogFinanceSlice | null>(null)
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState<FinancialAccountKind>('receivable')
  const [onlyOpen, setOnlyOpen] = useState(true)
  const [payableOpen, setPayableOpen] = useState(false)
  const [settling, setSettling] = useState<FinancialAccount | null>(null)
  const [saving, setSaving] = useState(false)
  const [payable, setPayable] = useState({ counterparty: '', description: '', amount: 0, dueDate: '' })
  const [settlement, setSettlement] = useState({
    amount: 0,
    paymentMethod: 'efectivo' as PaymentMethod,
    occurredAt: new Date().toISOString().slice(0, 16),
    note: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [nextSnapshot, nextCatalog] = await Promise.all([
        getFinanceSnapshot(period.from, period.to),
        getCatalogPaymentSlice(period.from, period.to),
      ])
      setSnapshot(nextSnapshot)
      setCatalog(nextCatalog)
    } catch (error) {
      console.error('[finance] snapshot', error)
      showError('No se pudo cargar el panel financiero')
    } finally {
      setLoading(false)
    }
  }, [period.from, period.to, showError])

  useEffect(() => { void load() }, [load])

  const accounts = useMemo(() => (snapshot?.accounts ?? []).filter((account) =>
    account.kind === kind && (!onlyOpen || (account.status !== 'settled' && account.status !== 'cancelled'))
  ), [snapshot, kind, onlyOpen])

  const openSettlement = (account: FinancialAccount) => {
    setSettling(account)
    setSettlement({
      amount: account.balance,
      paymentMethod: 'efectivo',
      occurredAt: new Date().toISOString().slice(0, 16),
      note: '',
    })
  }

  const submitPayable = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      await createPayable({
        counterparty: payable.counterparty,
        description: payable.description,
        amount: payable.amount,
        dueDate: payable.dueDate || null,
      })
      setPayableOpen(false)
      setPayable({ counterparty: '', description: '', amount: 0, dueDate: '' })
      showSuccess('Cuenta por pagar registrada')
      await load()
    } catch (error) {
      console.error('[finance] create payable', error)
      showError('No se pudo registrar la cuenta por pagar')
    } finally {
      setSaving(false)
    }
  }

  const submitSettlement = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!settling || saving) return
    setSaving(true)
    try {
      await recordSettlement({
        accountId: settling.id,
        amount: settlement.amount,
        paymentMethod: settlement.paymentMethod,
        occurredAt: new Date(settlement.occurredAt).toISOString(),
        note: settlement.note || null,
        idempotencyKey: crypto.randomUUID(),
      })
      setSettling(null)
      showSuccess(settling.kind === 'receivable' ? 'Cobro registrado' : 'Pago registrado y gasto generado')
      await load()
    } catch (error) {
      console.error('[finance] settlement', error)
      showError('No se pudo registrar el movimiento. Revisá el saldo y los datos.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = async (account: FinancialAccount) => {
    const ok = await confirm({
      title: '¿Cancelar esta cuenta por pagar?',
      description: 'Sólo puede cancelarse si todavía no tiene pagos registrados.',
      confirmLabel: 'Cancelar cuenta',
      danger: true,
    })
    if (!ok) return
    try {
      await cancelPayable(account.id, 'Cancelada desde el panel financiero')
      showSuccess('Cuenta cancelada conservando su historial')
      await load()
    } catch {
      showError('No se puede cancelar una cuenta con pagos registrados')
    }
  }

  if (loading && !snapshot) return <Loader text="Cargando cuentas y conciliación..." />

  const summary = snapshot?.summary
  const net = Number(summary?.period_inflow ?? 0) - Number(summary?.period_outflow ?? 0)

  return (
    <div className="space-y-8" data-testid="finance-ledger">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          ['Por cobrar', summary?.receivable_open ?? 0, 'text-amber-600'],
          ['Por pagar', summary?.payable_open ?? 0, 'text-rose-600'],
          ['Entradas del período', summary?.period_inflow ?? 0, 'text-emerald-600'],
          ['Flujo neto', net, net >= 0 ? 'text-blue-600' : 'text-rose-600'],
        ].map(([label, value, tone]) => (
          <PastelCard key={String(label)} className="p-5" noHover>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
            <p className={`mt-2 text-2xl font-black tabular-nums ${tone}`}>{money(Number(value))}</p>
          </PastelCard>
        ))}
      </div>

      <PastelCard className="p-5 sm:p-6" noHover>
        <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
          <div>
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Conciliación de caja</p>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">Entradas y salidas por medio</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="text-xs font-semibold text-gray-500">Desde
              <input aria-label="Conciliación desde" type="date" value={period.from} onChange={(e) => setPeriod((old) => ({ ...old, from: e.target.value }))} className="form-input block mt-1 rounded-lg" />
            </label>
            <label className="text-xs font-semibold text-gray-500">Hasta
              <input aria-label="Conciliación hasta" type="date" value={period.to} onChange={(e) => setPeriod((old) => ({ ...old, to: e.target.value }))} className="form-input block mt-1 rounded-lg" />
            </label>
          </div>
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b border-gray-200 dark:border-gray-700"><th className="py-3">Medio</th><th>Entradas</th><th>Salidas</th><th>Neto</th></tr></thead>
            <tbody>
              {(snapshot?.reconciliation ?? []).map((line) => (
                <tr key={line.payment_method} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <td className="py-3 font-semibold">{PAYMENT_METHOD_LABELS[line.payment_method]}</td>
                  <td className="text-emerald-600 font-bold">{money(line.inflow)}</td>
                  <td className="text-rose-600 font-bold">{money(line.outflow)}</td>
                  <td className="font-black">{money(line.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {snapshot?.reconciliation.length === 0 && <p className="py-8 text-center text-sm text-gray-500">Sin movimientos de caja en el período.</p>}
        </div>
      </PastelCard>

      {catalog && (
        <PastelCard className="p-5 sm:p-6" noHover data-testid="catalog-payment-slice">
          <p className="text-xs font-bold text-pink-600 uppercase tracking-wider">Resumen combinado</p>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">Mostrador, pedidos y total</h2>
          <p className="text-sm text-gray-500 mt-1">
            Los cobros online no se cargan como otro ingreso ni se mezclan con la caja del local.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
            <div className="rounded-xl border border-gray-100 px-3 py-3 dark:border-gray-800">
              <p className="text-[10px] uppercase text-gray-400 font-bold">Mostrador</p>
              <p className="font-black mt-1">{money(catalog.pos.net)}</p>
            </div>
            <div className="rounded-xl border border-gray-100 px-3 py-3 dark:border-gray-800">
              <p className="text-[10px] uppercase text-gray-400 font-bold">Pedidos</p>
              <p className="font-black mt-1">{money(catalog.catalog.net)}</p>
            </div>
            <div className="rounded-xl border border-pink-100 px-3 py-3 dark:border-pink-900">
              <p className="text-[10px] uppercase text-gray-400 font-bold">Neto combinado</p>
              <p className="font-black mt-1 text-pink-700">{money(catalog.combined.net)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 text-sm">
            <div>Cobrado: <strong>{money(catalog.margin.gross)}</strong></div>
            <div>Comisión estimada: <strong>{money(catalog.margin.estimated_fee)}</strong></div>
            <div>Comisión real: <strong>{money(catalog.margin.actual_fee)}</strong></div>
            <div>Reembolsos: <strong>{money(catalog.margin.refunds)}</strong></div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <a href={panelHref({ tab: 'orders' })} className="text-xs font-bold text-pink-600">Ver pedidos</a>
            <a href={panelHref({ tab: 'margin_reports', channel: 'combined' })} className="text-xs font-bold text-pink-600">Ver margen</a>
          </div>
          {catalog.methods.length > 0 && (
            <ul className="mt-4 text-sm space-y-1">
              {catalog.methods.map((line) => (
                <li key={line.method}>
                  {paymentMethodLabel((line.method || 'bank_transfer') as PaymentMethodCode)}: {money(line.net)}
                </li>
              ))}
            </ul>
          )}
        </PastelCard>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setKind('receivable')} className={`px-4 py-2 rounded-xl font-bold text-sm ${kind === 'receivable' ? 'bg-amber-500 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'}`}><ArrowDownLeft className="inline w-4 h-4 mr-1" /> Cuentas por cobrar</button>
          <button type="button" onClick={() => setKind('payable')} className={`px-4 py-2 rounded-xl font-bold text-sm ${kind === 'payable' ? 'bg-rose-500 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'}`}><ArrowUpRight className="inline w-4 h-4 mr-1" /> Cuentas por pagar</button>
          <label className="inline-flex items-center gap-2 px-3 text-sm font-semibold text-gray-600 dark:text-gray-300"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> Sólo pendientes</label>
        </div>
        {kind === 'payable' && <button type="button" onClick={() => setPayableOpen(true)} className="btn-primary px-4 py-2.5 rounded-xl"><Plus className="w-4 h-4" /> Nueva cuenta por pagar</button>}
      </div>

      {accounts.length === 0 ? (
        <EmptyState icon={<Scale className="w-10 h-10 text-indigo-400" />} title="No hay cuentas para mostrar" description={onlyOpen ? 'No quedan saldos pendientes en esta vista.' : 'Los movimientos aparecerán acá.'} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {accounts.map((account) => (
            <PastelCard key={account.id} className="p-5 sm:p-6" noHover>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{account.sale_id ? `Venta #${account.sale_id}` : account.counterparty}</p>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 mt-1 truncate">{account.description}</h3>
                  {account.due_date && <p className="text-xs text-gray-500 mt-2"><CalendarDays className="inline w-3.5 h-3.5 mr-1" /> Vence {new Date(`${account.due_date}T12:00:00`).toLocaleDateString('es-AR')}</p>}
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${account.status === 'settled' ? 'bg-emerald-100 text-emerald-700' : account.status === 'partial' ? 'bg-blue-100 text-blue-700' : account.status === 'cancelled' ? 'bg-gray-200 text-gray-600' : 'bg-amber-100 text-amber-700'}`}>{account.status === 'settled' ? 'Saldada' : account.status === 'partial' ? 'Parcial' : account.status === 'cancelled' ? 'Cancelada' : 'Pendiente'}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-5 py-4 border-y border-gray-100 dark:border-gray-700">
                <div><p className="text-[10px] uppercase text-gray-400 font-bold">Total</p><p className="font-bold mt-1">{money(account.net_amount)}</p></div>
                <div><p className="text-[10px] uppercase text-gray-400 font-bold">Registrado</p><p className="font-bold mt-1 text-emerald-600">{money(account.paid_amount)}</p></div>
                <div><p className="text-[10px] uppercase text-gray-400 font-bold">Saldo</p><p className="font-black mt-1 text-amber-600">{money(account.balance)}</p></div>
              </div>
              {account.movements.length > 0 && <div className="mt-4 space-y-2">{account.movements.slice(0, 3).map((movement) => <div key={movement.id} className="flex justify-between text-xs text-gray-500"><span>{new Date(movement.occurred_at).toLocaleDateString('es-AR')} · {PAYMENT_METHOD_LABELS[movement.payment_method]}</span><strong>{money(movement.amount)}</strong></div>)}</div>}
              {account.balance > 0 && account.status !== 'cancelled' && <div className="flex flex-wrap justify-end gap-2 mt-5"><button type="button" onClick={() => openSettlement(account)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm"><CircleDollarSign className="w-4 h-4" /> {account.kind === 'receivable' ? 'Registrar cobro' : 'Registrar pago'}</button>{account.kind === 'payable' && account.paid_amount === 0 && <button type="button" onClick={() => void handleCancel(account)} className="px-3 py-2 rounded-xl text-sm font-bold text-rose-600 border border-rose-200">Cancelar</button>}</div>}
            </PastelCard>
          ))}
        </div>
      )}

      {(payableOpen || settling) && <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
        <PastelCard className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 sm:p-8" noHover>
          <div className="flex justify-between gap-4"><div><p className="text-xs uppercase tracking-wider font-bold text-indigo-500">Stage 6.6</p><h3 className="text-xl font-black mt-1">{settling ? (settling.kind === 'receivable' ? 'Registrar cobro' : 'Registrar pago') : 'Nueva cuenta por pagar'}</h3></div><button type="button" aria-label="Cerrar" onClick={() => { setPayableOpen(false); setSettling(null) }}><X /></button></div>
          {settling ? <form onSubmit={submitSettlement} className="mt-6 space-y-4">
            <p className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-sm">Saldo disponible: <strong>{money(settling.balance)}</strong></p>
            <label className="block text-sm font-semibold">Monto<input type="number" min="0.01" max={settling.balance} step="0.01" required value={settlement.amount || ''} onChange={(e) => setSettlement((old) => ({ ...old, amount: Number(e.target.value) }))} className="form-input w-full mt-1 rounded-xl" /></label>
            <label className="block text-sm font-semibold">Medio<select value={settlement.paymentMethod} onChange={(e) => setSettlement((old) => ({ ...old, paymentMethod: e.target.value as PaymentMethod }))} className="form-input w-full mt-1 rounded-xl">{METHODS.map((method) => <option key={method} value={method}>{PAYMENT_METHOD_LABELS[method]}</option>)}</select></label>
            <label className="block text-sm font-semibold">Fecha y hora<input type="datetime-local" required value={settlement.occurredAt} onChange={(e) => setSettlement((old) => ({ ...old, occurredAt: e.target.value }))} className="form-input w-full mt-1 rounded-xl" /></label>
            <label className="block text-sm font-semibold">Nota opcional<textarea minLength={3} value={settlement.note} onChange={(e) => setSettlement((old) => ({ ...old, note: e.target.value }))} className="form-input w-full mt-1 rounded-xl" rows={3} /></label>
            <button type="submit" disabled={saving} className="btn-primary w-full py-3 rounded-xl"><CheckCircle2 className="w-4 h-4" /> {saving ? 'Registrando...' : 'Confirmar movimiento'}</button>
          </form> : <form onSubmit={submitPayable} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold">Proveedor o acreedor<input required minLength={2} maxLength={200} value={payable.counterparty} onChange={(e) => setPayable((old) => ({ ...old, counterparty: e.target.value }))} className="form-input w-full mt-1 rounded-xl" /></label>
            <label className="block text-sm font-semibold">Concepto<textarea required minLength={3} maxLength={500} value={payable.description} onChange={(e) => setPayable((old) => ({ ...old, description: e.target.value }))} className="form-input w-full mt-1 rounded-xl" rows={3} /></label>
            <label className="block text-sm font-semibold">Monto<input type="number" min="0.01" step="0.01" required value={payable.amount || ''} onChange={(e) => setPayable((old) => ({ ...old, amount: Number(e.target.value) }))} className="form-input w-full mt-1 rounded-xl" /></label>
            <label className="block text-sm font-semibold">Vencimiento opcional<input type="date" value={payable.dueDate} onChange={(e) => setPayable((old) => ({ ...old, dueDate: e.target.value }))} className="form-input w-full mt-1 rounded-xl" /></label>
            <button type="submit" disabled={saving} className="btn-primary w-full py-3 rounded-xl"><Plus className="w-4 h-4" /> {saving ? 'Guardando...' : 'Registrar deuda'}</button>
          </form>}
        </PastelCard>
      </div>}
      <ConfirmDialog {...confirmProps} testId="confirm-finance" />
    </div>
  )
}
