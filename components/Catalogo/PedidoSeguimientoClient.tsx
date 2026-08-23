'use client'

import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  Truck,
  Upload,
} from 'lucide-react'
import { formatPesoARExact } from '@/lib/formatPesoAR'
import { PUBLIC_PAYMENT_COPY } from '@/lib/domain/payments/labels'
import { paymentStatusLabel, type PaymentStatus } from '@/lib/domain/payments/states'
import { fulfillmentPublicLine } from '@/lib/domain/orders/fulfillment'
import { buildTransferWhatsAppMessage } from '@/lib/domain/orders/whatsappMessage'
import { openWhatsApp } from '@/lib/whatsappLink'
import {
  getFollowOrderAction,
  completeFollowTransferReceiptUploadAction,
  prepareFollowTransferReceiptUploadAction,
  startFollowBankTransferAction,
  startFollowMercadoPagoAction,
} from '@/app/actions/payments'
import type { PublicFollowView } from '@/lib/domain/payments/types'
import { uploadPaymentReceiptDirect } from '@/lib/domain/payments/browserReceiptUpload'

function statusLabel(status: string | null): string {
  if (!status) return 'Pendiente de pago'
  return paymentStatusLabel(status as PaymentStatus)
}

function hasBankDetails(bank: PublicFollowView['bank']): boolean {
  if (!bank) return false
  return Boolean(bank.cbu || bank.alias || bank.bank_name || bank.account_holder || bank.cuit || bank.instructions)
}

function orderStatusBadgeInfo(orderStatus: string, paymentStatus: string | null): { label: string; colorClass: string; stepIndex: number } {
  if (orderStatus === 'cancelled') {
    return { label: 'Pedido Cancelado', colorClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/40', stepIndex: 0 }
  }
  if (orderStatus === 'completed') {
    return { label: 'Entregado con Éxito ✨', colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40', stepIndex: 5 }
  }
  if (orderStatus === 'ready') {
    return { label: 'En Camino / Listo para entrega 🚚', colorClass: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/40', stepIndex: 4 }
  }
  if (orderStatus === 'preparing') {
    return { label: 'En Preparación 📦', colorClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40', stepIndex: 3 }
  }
  if (orderStatus === 'confirmed' || paymentStatus === 'approved') {
    return { label: 'Pago Aprobado · Confirmado', colorClass: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-900/40', stepIndex: 2 }
  }
  return { label: 'Pedido Recibido · Pendiente de Pago', colorClass: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700', stepIndex: 1 }
}

type Props = {
  orderNumber: string
  initialError?: string | null
}

export function PedidoSeguimientoClient({ orderNumber, initialError = null }: Props) {
  const [view, setView] = useState<PublicFollowView | null>(null)
  const [error, setError] = useState<string | null>(initialError)
  const [pending, startTransition] = useTransition()
  const [fileError, setFileError] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const transferKey = useRef(crypto.randomUUID())
  const mpKey = useRef(crypto.randomUUID())

  function refresh() {
    startTransition(async () => {
      const result = await getFollowOrderAction(orderNumber)
      if (!result.ok) {
        setError(result.error)
        setView(null)
        return
      }
      setError(null)
      setView(result.data)
    })
  }

  useEffect(() => {
    if (initialError) return
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber, initialError])

  function startTransfer() {
    startTransition(async () => {
      const result = await startFollowBankTransferAction(orderNumber, transferKey.current)
      if (!result.ok) {
        setError(result.error)
        return
      }
      refresh()
    })
  }

  function startMercadoPago() {
    startTransition(async () => {
      const result = await startFollowMercadoPagoAction(orderNumber, mpKey.current)
      if (!result.ok) {
        setError(result.error)
        return
      }
      window.location.assign(result.data.checkout_url)
    })
  }

  function onFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const input = form.elements.namedItem('file')
    const file = input instanceof HTMLInputElement ? input.files?.[0] : null
    if (!file) {
      setFileError('Elegí una imagen o un PDF.')
      return
    }
    setFileError(null)
    startTransition(async () => {
      const result = await uploadPaymentReceiptDirect(
        file,
        (metadata) => prepareFollowTransferReceiptUploadAction(orderNumber, metadata),
        (path) => completeFollowTransferReceiptUploadAction(orderNumber, path)
      )
      if (!result.ok) {
        setFileError(result.error)
        return
      }
      form.reset()
      refresh()
    })
  }

  const copyValue = (key: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2500)
  }

  const transferAmount = view?.amount_due && view.method === 'bank_transfer'
    ? view.amount_due
    : view?.quoted_base_amount ?? view?.base_amount ?? null
  const showMethodChoice = Boolean(view && !view.payment_status)
  const showRetryTransfer = Boolean(view?.can_retry && view.transfer_available)
  const showRetryMp = Boolean(view?.can_retry && view.mp_available)
  const paying = pending && Boolean(view)

  const badgeInfo = view
    ? orderStatusBadgeInfo(view.order_status, view.payment_status)
    : { label: 'Cargando...', colorClass: '', stepIndex: 1 }

  // Stepper progress calculation
  const progressPercent =
    badgeInfo.stepIndex === 5 ? '100%'
    : badgeInfo.stepIndex === 4 ? '75%'
    : badgeInfo.stepIndex === 3 ? '50%'
    : badgeInfo.stepIndex === 2 ? '25%'
    : '5%'

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12 text-[#1A181E] dark:text-[#F6EEF3]">
      
      {/* Header Tracking Card */}
      <div className="relative overflow-hidden rounded-3xl border border-[#EBE4DA] bg-white p-6 sm:p-8 shadow-sm dark:border-white/10 dark:bg-[#1C1924]">
        
        {/* Top Gradient Stripe */}
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#D97786] via-[#C5A880] to-[#E28292]" />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#C5A880]">
              Seguimiento Oficial de Pedido
            </p>
            <h1 className="mt-1 font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#1A181E] dark:text-[#F6EEF3]">
              {view?.order_number || orderNumber}
            </h1>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold shadow-2xs ${badgeInfo.colorClass}`}>
            <span className="h-2 w-2 rounded-full bg-current" />
            <span>{badgeInfo.label}</span>
          </span>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm font-semibold text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200" role="alert">
            {error}
          </p>
        )}

        {/* 5-Step Visual Stepper */}
        {view && view.order_status !== 'cancelled' && (
          <div className="mt-8 border-t border-[#EBE4DA] pt-6 dark:border-white/10">
            <div className="relative flex justify-between">
              
              {/* Background Line */}
              <div className="absolute top-4.5 left-4 right-4 h-1 rounded-full bg-gray-100 dark:bg-zinc-800" />
              
              {/* Active Progress Line */}
              <div
                className="absolute top-4.5 left-4 h-1 rounded-full bg-gradient-to-r from-[#D97786] to-[#C5A880] transition-all duration-500"
                style={{ width: progressPercent }}
              />

              {/* Steps */}
              {[
                { idx: 1, label: 'Recibido', icon: Clock },
                { idx: 2, label: 'Pago', icon: CheckCircle2 },
                { idx: 3, label: 'Preparación', icon: Package },
                { idx: 4, label: 'En Camino', icon: Truck },
                { idx: 5, label: 'Entregado', icon: Check },
              ].map((s) => {
                const Icon = s.icon
                const isDone = badgeInfo.stepIndex > s.idx
                const isCurrent = badgeInfo.stepIndex === s.idx

                return (
                  <div key={s.idx} className="relative z-10 flex flex-1 flex-col items-center text-center">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold transition-all ${
                        isDone
                          ? 'border-[#D97786] bg-[#D97786] text-white'
                          : isCurrent
                            ? 'border-[#D97786] bg-white text-[#D97786] ring-4 ring-[#FDF2F4] dark:bg-[#1C1924] dark:ring-pink-950/40'
                            : 'border-gray-200 bg-white text-gray-400 dark:border-zinc-700 dark:bg-zinc-800'
                      }`}
                    >
                      {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <span
                      className={`mt-2 text-[11px] font-bold ${
                        isCurrent || isDone
                          ? 'text-[#1A181E] dark:text-[#F6EEF3]'
                          : 'text-gray-400 dark:text-zinc-500'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>

      {view && (
        <section className="mt-6 flex flex-col gap-6">

          {/* Delivery & Payment Information Card */}
          <div className="grid gap-4 sm:grid-cols-2 rounded-3xl border border-[#EBE4DA] bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#1C1924]">
            
            {/* Delivery Details */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#C5A880]">
                <MapPin className="h-3.5 w-3.5" />
                <span>Forma de Entrega</span>
              </div>
              <p className="font-bold text-sm text-[#1A181E] dark:text-[#F6EEF3]">
                {fulfillmentPublicLine({
                  mode: view.fulfillment_mode,
                  carrier: view.shipping_carrier,
                  service: view.shipping_service,
                  estimate: view.shipping_delivery_estimate,
                })}
              </p>
              {view.shipping_carrier && (
                <p className="font-mono text-xs text-gray-500 dark:text-zinc-400">
                  Transporte: {view.shipping_carrier} {view.shipping_service ? `(${view.shipping_service})` : ''}
                </p>
              )}
              {view.fulfillment_mode === 'envio' && view.shipping_amount > 0 && (
                <p className="text-xs font-semibold text-[#635F6A] dark:text-[#A8A3B0]">
                  Costo de envío: ${formatPesoARExact(view.shipping_amount)}
                </p>
              )}
            </div>

            {/* Payment Details */}
            <div className="flex flex-col gap-1.5 border-t border-[#EBE4DA] pt-4 sm:border-t-0 sm:border-l sm:pl-4 sm:pt-0 dark:border-white/10">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#C5A880]">
                <CreditCard className="h-3.5 w-3.5" />
                <span>Estado del Pago</span>
              </div>
              <p className="font-bold text-sm text-[#1A181E] dark:text-[#F6EEF3]">
                {statusLabel(view.payment_status)}
              </p>
              {view.method && (
                <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">
                  Método: {view.method === 'mercado_pago' ? 'Mercado Pago' : view.method === 'bank_transfer' ? 'Transferencia Bancaria' : view.method}
                </p>
              )}
            </div>

          </div>

          {/* Pending Payment Choices (if unpaid) */}
          {showMethodChoice && (
            <div className="rounded-3xl border-2 border-pink-200 bg-white p-6 shadow-sm dark:border-pink-900/40 dark:bg-[#1C1924]">
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#C25B6C] dark:text-[#F472B6]">
                Completá tu pago para confirmar la preparación
              </p>
              
              <div className="mt-4 flex flex-col gap-3">
                {view.mp_available && view.quoted_public_amount != null && (
                  <button
                    type="button"
                    disabled={paying}
                    onClick={startMercadoPago}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#009EE3] to-[#007EB5] py-3.5 font-bold text-white shadow-md shadow-[#009EE3]/20 hover:brightness-105 disabled:opacity-60"
                    data-testid="pay-mercadopago"
                  >
                    <span>{PUBLIC_PAYMENT_COPY.mercadoPago} · ${formatPesoARExact(view.quoted_public_amount)}</span>
                    <ExternalLink className="h-4 w-4" />
                  </button>
                )}

                {transferAmount != null && (
                  view.transfer_available ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={startTransfer}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#D97786] bg-[#FDF2F4] py-3 font-bold text-[#C25B6C] hover:bg-[#D97786] hover:text-white disabled:opacity-60 dark:bg-[#2D1823] dark:text-[#F472B6]"
                    >
                      <span>{PUBLIC_PAYMENT_COPY.bankTransfer} · ${formatPesoARExact(transferAmount)} (10% OFF)</span>
                    </button>
                  ) : (
                    <div className="rounded-xl border border-pink-100 bg-[#FAF8F5] p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900/50">
                      <p className="text-gray-600 dark:text-zinc-300">
                        Escribinos por WhatsApp y te pasamos el Alias al instante para transferir con 10% off.
                      </p>
                      <button
                        type="button"
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white"
                        onClick={() => {
                          const ok = openWhatsApp(buildTransferWhatsAppMessage({
                            order_number: view.order_number,
                            amount: transferAmount,
                          }), false)
                          if (!ok) setError('No se pudo abrir WhatsApp. Tu pedido ya está registrado.')
                        }}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>Pedir datos bancarios</span>
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* Mercado Pago In-Progress Pending */}
          {view.method === 'mercado_pago' && view.payment_status === 'pending' && (
            <div className="rounded-3xl border border-sky-200 bg-sky-50/50 p-6 dark:border-sky-900/40 dark:bg-sky-950/20">
              <p className="text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300">
                Pago Pendiente en Mercado Pago
              </p>
              {view.amount_due != null && (
                <p className="mt-1 font-mono text-3xl font-extrabold text-gray-900 dark:text-white">
                  ${formatPesoARExact(view.amount_due)}
                </p>
              )}
              {view.checkout_url ? (
                <a
                  href={view.checkout_url}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#009EE3] py-3.5 font-bold text-white shadow-md transition-all hover:bg-[#007EB5]"
                >
                  <span>Continuar el pago en Mercado Pago</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : (
                <button
                  type="button"
                  disabled={paying}
                  onClick={startMercadoPago}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#009EE3] py-3.5 font-bold text-white"
                >
                  {PUBLIC_PAYMENT_COPY.mercadoPago}
                </button>
              )}
              <p className="mt-2.5 text-xs text-gray-500 dark:text-zinc-400">{PUBLIC_PAYMENT_COPY.returnInformative}</p>
            </div>
          )}

          {/* Bank Transfer Details with 1-Click Copy */}
          {view.method === 'bank_transfer' && (
            <div className="rounded-3xl border border-[#EBE4DA] bg-white p-6 dark:border-white/10 dark:bg-[#1C1924]">
              <div className="flex items-center justify-between border-b border-[#EBE4DA] pb-3 dark:border-white/10">
                <p className="text-xs font-extrabold uppercase tracking-wider text-[#C5A880]">
                  {PUBLIC_PAYMENT_COPY.transferInstructions}
                </p>
                {transferAmount != null && (
                  <span className="font-mono text-lg font-bold text-[#C25B6C] dark:text-[#F472B6]">
                    ${formatPesoARExact(transferAmount)}
                  </span>
                )}
              </div>

              {hasBankDetails(view.bank) ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 text-xs">
                  {view.bank?.bank_name && (
                    <div className="rounded-xl bg-[#FAF8F5] p-3 dark:bg-[#15131C]">
                      <span className="text-[10px] font-bold uppercase text-gray-400">Banco</span>
                      <p className="mt-0.5 font-semibold text-gray-800 dark:text-gray-100">{view.bank.bank_name}</p>
                    </div>
                  )}
                  {view.bank?.account_holder && (
                    <div className="rounded-xl bg-[#FAF8F5] p-3 dark:bg-[#15131C]">
                      <span className="text-[10px] font-bold uppercase text-gray-400">Titular</span>
                      <p className="mt-0.5 font-semibold text-gray-800 dark:text-gray-100">{view.bank.account_holder}</p>
                    </div>
                  )}
                  {view.bank?.alias && (
                    <div className="rounded-xl bg-[#FAF8F5] p-3 sm:col-span-2 dark:bg-[#15131C]">
                      <span className="text-[10px] font-bold uppercase text-gray-400">Alias de Transferencia</span>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="font-mono text-sm font-extrabold text-[#C25B6C] dark:text-[#F472B6]">{view.bank.alias}</p>
                        <button
                          type="button"
                          onClick={() => copyValue('alias', view.bank!.alias!)}
                          className="flex items-center gap-1 rounded-lg border border-pink-200 bg-white px-2.5 py-1 text-xs font-bold text-[#C25B6C] shadow-2xs hover:bg-pink-50 dark:border-pink-900/50 dark:bg-zinc-800 dark:text-[#F472B6]"
                        >
                          {copiedKey === 'alias' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          <span>{copiedKey === 'alias' ? '¡Copiado!' : 'Copiar'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                  {view.bank?.cbu && (
                    <div className="rounded-xl bg-[#FAF8F5] p-3 sm:col-span-2 dark:bg-[#15131C]">
                      <span className="text-[10px] font-bold uppercase text-gray-400">CBU / CVU</span>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="break-all font-mono text-xs font-bold text-gray-700 dark:text-gray-300">{view.bank.cbu}</p>
                        <button
                          type="button"
                          onClick={() => copyValue('cbu', view.bank!.cbu!)}
                          className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200"
                        >
                          {copiedKey === 'cbu' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          <span>{copiedKey === 'cbu' ? '¡Copiado!' : 'Copiar'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-xs text-gray-600 dark:text-zinc-300">
                  En breve te pasamos los datos de la cuenta para transferir.
                </p>
              )}

              {/* Upload Receipt */}
              {view.payment_status && ['pending', 'requires_review'].includes(view.payment_status) && (
                <form
                  className="mt-4 flex flex-col gap-2.5 border-t border-[#EBE4DA] pt-4 dark:border-white/10"
                  onSubmit={onFile}
                >
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300" htmlFor="comprobante">
                    Adjuntar Comprobante de Pago
                  </label>
                  <div className="relative flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-[#FAF8F5] p-4 text-center dark:border-zinc-700 dark:bg-[#15131C]">
                    <input
                      id="comprobante"
                      name="file"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      required
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center gap-1 text-xs text-gray-500">
                      <Upload className="h-5 w-5 text-[#D97786]" />
                      <span className="font-semibold text-gray-700 dark:text-gray-200">Hacé clic para seleccionar archivo</span>
                      <span>(JPG, PNG o PDF)</span>
                    </div>
                  </div>
                  {fileError && <p className="text-xs text-rose-700 dark:text-rose-300">{fileError}</p>}
                  <button
                    type="submit"
                    disabled={pending}
                    className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#CF6B7F] to-[#B85064] py-3 text-sm font-bold text-white shadow-sm disabled:opacity-60"
                  >
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    <span>{view.has_receipt ? 'Reemplazar comprobante' : 'Enviar comprobante'}</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Payment Retries */}
          {(showRetryTransfer || showRetryMp) && (
            <div className="flex flex-col gap-2">
              {showRetryMp && (
                <button
                  type="button"
                  disabled={paying}
                  onClick={startMercadoPago}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#009EE3] py-3 text-sm font-bold text-white shadow-sm"
                >
                  Intentar de nuevo con Mercado Pago
                </button>
              )}
              {showRetryTransfer && (
                <button
                  type="button"
                  disabled={paying}
                  onClick={startTransfer}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-pink-200 py-3 text-sm font-bold text-[#C25B6C]"
                >
                  Intentar de nuevo por transferencia
                </button>
              )}
            </div>
          )}

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={`https://wa.me/5491158492310?text=Hola%20Ilara%20Beauty!%20Tengo%20una%20consulta%20sobre%20mi%20pedido%20${encodeURIComponent(view.order_number)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-3.5 font-bold text-white shadow-md shadow-[#25D366]/20 transition-all hover:brightness-105"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Consultar por WhatsApp</span>
            </a>

            <Link
              href="/catalogo"
              className="flex items-center justify-center rounded-2xl border border-[#EBE4DA] bg-white px-6 py-3.5 text-sm font-bold text-[#1A181E] shadow-2xs hover:bg-[#FAF8F5] dark:border-white/10 dark:bg-[#1C1924] dark:text-[#F6EEF3] dark:hover:bg-[#26222E]"
            >
              Volver al catálogo
            </Link>
          </div>

        </section>
      )}

    </main>
  )
}
