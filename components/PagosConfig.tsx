'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  activatePricingVersion,
  fetchPaymentOpsBoard,
  listPricingVersions,
  previewPricing,
  savePricingDraft,
} from '@/lib/domain/payments/browserPricing'
import type { PaymentOpsBoard } from '@/lib/domain/payments/finance'
import { paymentMethodLabel, paymentStatusLabel, type PaymentMethodCode, type PaymentStatus } from '@/lib/domain/payments/states'
import type { PricingPreview, PricingVersion } from '@/lib/domain/payments/types'
import { formatPesoAR } from '@/lib/formatPesoAR'
import { toUserMessage } from '@/lib/domain/errors'
import { useConfirm } from '@/hooks/useConfirm'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

function activationIssues(version: PricingVersion): string[] {
  const issues: string[] = []
  if ((version.mercado_pago_enabled || version.bank_transfer_enabled) && !version.payments_enabled) {
    issues.push('Primero habilitá los cobros online.')
  }
  if (version.payments_enabled && !version.mercado_pago_enabled && !version.bank_transfer_enabled) {
    issues.push('Elegí al menos un medio de cobro.')
  }
  if (version.bank_transfer_enabled) {
    const hasDestination = Boolean(version.bank_cbu?.trim() || version.bank_alias?.trim())
    if (!hasDestination || !version.bank_name?.trim() || !version.bank_account_holder?.trim() || !version.bank_cuit?.trim()) {
      issues.push('Completá los datos de la cuenta para recibir transferencias.')
    }
  }
  return issues
}

export default function PagosConfig() {
  const { confirm, confirmProps } = useConfirm()
  const [versions, setVersions] = useState<PricingVersion[]>([])
  const [preview, setPreview] = useState<PricingPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fee, setFee] = useState('0.053119')
  const [increment, setIncrement] = useState('100')
  const [paymentsEnabled, setPaymentsEnabled] = useState(false)
  const [mpEnabled, setMpEnabled] = useState(false)
  const [transferEnabled, setTransferEnabled] = useState(false)
  const [dualPriceVisible, setDualPriceVisible] = useState(false)
  const [bankCbu, setBankCbu] = useState('')
  const [bankAlias, setBankAlias] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankHolder, setBankHolder] = useState('')
  const [bankCuit, setBankCuit] = useState('')
  const [bankInstructions, setBankInstructions] = useState('')
  const [board, setBoard] = useState<PaymentOpsBoard | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, nextPreview, nextBoard] = await Promise.all([
        listPricingVersions(),
        previewPricing(),
        fetchPaymentOpsBoard(),
      ])
      setVersions(list)
      setPreview(nextPreview)
      setBoard(nextBoard)
      setFee(String(nextPreview.version.effective_fee_rate))
      setIncrement(String(nextPreview.version.rounding_increment))
      setPaymentsEnabled(nextPreview.version.payments_enabled)
      setMpEnabled(nextPreview.version.mercado_pago_enabled)
      setTransferEnabled(nextPreview.version.bank_transfer_enabled)
      setDualPriceVisible(nextPreview.version.catalog_dual_price_visible)
      setBankCbu(nextPreview.version.bank_cbu ?? '')
      setBankAlias(nextPreview.version.bank_alias ?? '')
      setBankName(nextPreview.version.bank_name ?? '')
      setBankHolder(nextPreview.version.bank_account_holder ?? '')
      setBankCuit(nextPreview.version.bank_cuit ?? '')
      setBankInstructions(nextPreview.version.bank_instructions ?? '')
    } catch (cause) {
      setError(toUserMessage(cause, 'No se pudo cargar la configuración de precios.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSaveDraft() {
    setSaving(true)
    setError(null)
    try {
      await savePricingDraft({
        effective_fee_rate: Number(fee),
        rounding_increment: Number(increment),
        listed_fee_rate: 0.0439,
        iva_rate: 0.21,
        payments_enabled: paymentsEnabled,
        mercado_pago_enabled: mpEnabled,
        bank_transfer_enabled: transferEnabled,
        catalog_dual_price_visible: dualPriceVisible,
        bank_cbu: bankCbu,
        bank_alias: bankAlias,
        bank_name: bankName,
        bank_account_holder: bankHolder,
        bank_cuit: bankCuit,
        bank_instructions: bankInstructions,
        notes: 'Versión configurada desde panel admin.',
      })
      await load()
    } catch (cause) {
      setError(toUserMessage(cause, 'No se pudo guardar el borrador.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleActivate(id: string) {
    const version = versions.find((item) => item.id === id)
    if (!version) {
      setError('No encontramos esa configuración. Actualizá la página e intentá de nuevo.')
      return
    }
    const issues = activationIssues(version)
    if (issues.length > 0) {
      setError(issues.join(' '))
      return
    }
    if (version.payments_enabled && !await confirm({
      title: 'Publicar opciones de cobro',
      description: 'Las clientas podrán elegir los medios seleccionados al realizar un pedido. Confirmá que revisaste la configuración antes de continuar.',
      confirmLabel: 'Publicar',
      cancelLabel: 'Volver a revisar',
      danger: false,
    })) return

    setSaving(true)
    setError(null)
    try {
      await activatePricingVersion(id)
      await load()
    } catch (cause) {
      setError(toUserMessage(cause, 'No se pudo activar la versión.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex flex-col gap-5 pb-5 animate-fade-in" data-testid="payments-config-panel">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-50">
            Precios y pagos
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Configurá los precios y las opciones de cobro. Cada pedido se administra desde Pedidos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-extrabold dark:border-zinc-700"
        >
          <RefreshCw size={14} aria-hidden /> Actualizar
        </button>
      </div>

      {error && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200" role="alert">
          {error}
        </p>
      )}

      {loading && <p className="text-sm text-gray-500">Cargando configuración…</p>}

      {preview && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              Comisión efectiva
              <input
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                value={fee}
                onChange={(event) => setFee(event.target.value)}
                inputMode="decimal"
                aria-describedby="fee-help"
              />
              <span id="fee-help" className="text-xs text-gray-500">
                Ayuda: 4,39% + IVA ≈ 0,053119. No se muestra en el catálogo.
              </span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Redondeo
              <input
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                value={increment}
                onChange={(event) => setIncrement(event.target.value)}
                inputMode="numeric"
              />
            </label>
            <div className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-zinc-700">
              <p>Productos afectados: <strong>{preview.affected_products}</strong></p>
              <p>Combos afectados: <strong>{preview.affected_combos}</strong></p>
              <p>Catálogo dual: <strong>{preview.version.catalog_dual_price_visible ? 'visible' : 'oculto'}</strong></p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              CBU
              <input
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                value={bankCbu}
                onChange={(event) => setBankCbu(event.target.value)}
                autoComplete="off"
                maxLength={32}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Alias
              <input
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                value={bankAlias}
                onChange={(event) => setBankAlias(event.target.value)}
                autoComplete="off"
                maxLength={40}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Banco
              <input
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                value={bankName}
                onChange={(event) => setBankName(event.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Titular
              <input
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                value={bankHolder}
                onChange={(event) => setBankHolder(event.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              CUIT
              <input
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                value={bankCuit}
                onChange={(event) => setBankCuit(event.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              Indicaciones para transferir
              <textarea
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                value={bankInstructions}
                onChange={(event) => setBankInstructions(event.target.value)}
                rows={3}
              />
            </label>
          </div>
          <p className="text-xs text-gray-500">
            Dejá vacío lo que todavía no tengas. No se guardan datos de ejemplo.
          </p>

          <div className="rounded-2xl border border-gray-200 p-4 dark:border-zinc-800 flex flex-col gap-3">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Opciones disponibles en la tienda</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-pink-600 focus:ring-pink-500 h-4 w-4"
                  checked={paymentsEnabled}
                  onChange={(e) => {
                    setPaymentsEnabled(e.target.checked)
                    if (!e.target.checked) {
                      setMpEnabled(false)
                      setTransferEnabled(false)
                    }
                  }}
                />
                <span className="font-semibold">Permitir cobros online</span>
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-pink-600 focus:ring-pink-500 h-4 w-4"
                  checked={mpEnabled}
                  disabled={!paymentsEnabled}
                  onChange={(e) => setMpEnabled(e.target.checked)}
                />
                <span className="font-semibold">Ofrecer Mercado Pago</span>
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-pink-600 focus:ring-pink-500 h-4 w-4"
                  checked={transferEnabled}
                  disabled={!paymentsEnabled}
                  onChange={(e) => setTransferEnabled(e.target.checked)}
                />
                <span className="font-semibold">Ofrecer transferencia</span>
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-pink-600 focus:ring-pink-500 h-4 w-4"
                  checked={dualPriceVisible}
                  onChange={(e) => setDualPriceVisible(e.target.checked)}
                />
                <span className="font-semibold">Mostrar doble precio en catálogo</span>
              </label>
            </div>
            <p className="text-xs text-gray-500">
              Guardá los cambios para revisarlos. Cuando publiques esta configuración, las clientas verán las opciones elegidas al hacer su pedido.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveDraft()}
              className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60"
            >
              Guardar borrador
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-zinc-800">
            <table className="min-w-full text-sm">
              <caption className="sr-only">Vista previa de precios</caption>
              <thead className="bg-gray-50 text-left dark:bg-zinc-900">
                <tr>
                  <th className="px-3 py-2">Artículo</th>
                  <th className="px-3 py-2">Lista / transferencia</th>
                  <th className="px-3 py-2">Público</th>
                  <th className="px-3 py-2">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {preview.samples.map((row) => (
                  <tr key={`${row.kind}-${row.id}`} className="border-t border-gray-100 dark:border-zinc-800">
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2">${formatPesoAR(row.transfer_price)}</td>
                    <td className="px-3 py-2">${formatPesoAR(row.public_price)}</td>
                    <td className="px-3 py-2">${formatPesoAR(row.saving)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {board && (
        <div className="rounded-2xl border border-gray-200 p-4 dark:border-zinc-800" data-testid="payments-ops-board">
          <h3 className="text-lg font-bold">Estado operativo</h3>
          <p className="text-sm text-gray-500 mt-1">
            Cobros {board.flags.payments_enabled ? 'habilitados' : 'apagados'} ·
            Mercado Pago {board.flags.mercado_pago_enabled ? 'habilitado' : 'apagado'} ·
            Transferencia {board.flags.bank_transfer_enabled ? 'habilitada' : 'apagada'}
          </p>
          <p className="text-sm mt-2">
            Pedidos pendientes: {board.expire.has_run
              ? `última revisión ${new Date(board.expire.last_finished_at || '').toLocaleString('es-AR')}`
              : 'todavía no hay revisiones registradas'}
          </p>
          {board.findings.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {board.findings.map((finding, index) => (
                <li key={`${finding.code}-${index}`} className={finding.severity === 'critical' ? 'text-rose-700' : ''}>
                  {finding.detail}{finding.order_number ? ` · ${finding.order_number}` : ''}
                </li>
              ))}
            </ul>
          )}
          {board.findings.length === 0 && (
            <p className="mt-3 text-sm text-gray-500">No hay alertas de conciliación.</p>
          )}
          {board.recent.length > 0 && (
            <ul className="mt-4 divide-y divide-gray-100 text-sm dark:divide-zinc-800">
              {board.recent.slice(0, 8).map((row) => (
                <li key={row.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>{row.order_number} · {paymentMethodLabel((row.method || 'bank_transfer') as PaymentMethodCode)}</span>
                  <span>{paymentStatusLabel((row.status || 'pending') as PaymentStatus)} · ${formatPesoAR(row.amount_due)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div>
        <h3 className="text-lg font-bold mb-2">Historial de versiones</h3>
        <ul className="flex flex-col gap-2">
          {versions.map((version) => (
            <li
              key={version.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 px-3 py-2 dark:border-zinc-800"
            >
              <span>
                v{version.version_number} · {version.status} · tasa {version.effective_fee_rate}
              </span>
              {version.status !== 'active' && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleActivate(version.id)}
                  className="text-xs font-extrabold text-pink-700 dark:text-pink-300"
                >
                  Publicar esta versión
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
      <ConfirmDialog {...confirmProps} testId="confirm-payment-publication" />
    </section>
  )
}
