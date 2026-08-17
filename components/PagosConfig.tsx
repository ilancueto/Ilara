'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  activatePricingVersion,
  listPricingVersions,
  previewPricing,
  savePricingDraft,
} from '@/lib/domain/payments/browserPricing'
import type { PricingPreview, PricingVersion } from '@/lib/domain/payments/types'
import { formatPesoAR } from '@/lib/formatPesoAR'
import { toUserMessage } from '@/lib/domain/errors'

export default function PagosConfig() {
  const [versions, setVersions] = useState<PricingVersion[]>([])
  const [preview, setPreview] = useState<PricingPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fee, setFee] = useState('0.053119')
  const [increment, setIncrement] = useState('100')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, nextPreview] = await Promise.all([listPricingVersions(), previewPricing()])
      setVersions(list)
      setPreview(nextPreview)
      setFee(String(nextPreview.version.effective_fee_rate))
      setIncrement(String(nextPreview.version.rounding_increment))
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
        payments_enabled: false,
        mercado_pago_enabled: false,
        bank_transfer_enabled: false,
        catalog_dual_price_visible: false,
        notes: 'Borrador Stage 8.1. Flags apagados.',
      })
      await load()
    } catch (cause) {
      setError(toUserMessage(cause, 'No se pudo guardar el borrador.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleActivate(id: string) {
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
            El precio de lista no se pisa. El precio público se calcula sobre una versión y hoy está oculto en el catálogo.
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
                  Restaurar / activar
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
