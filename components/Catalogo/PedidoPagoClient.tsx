'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Check, Copy, CreditCard, ExternalLink, FileText, Loader2, MessageCircle, ShieldCheck, Upload, Zap } from 'lucide-react'
import { formatPesoARExact } from '@/lib/formatPesoAR'
import { PUBLIC_PAYMENT_COPY } from '@/lib/domain/payments/labels'
import { paymentStatusLabel, type PaymentStatus } from '@/lib/domain/payments/states'
import { loadOrderAccess, paymentStartKey, storedFollow } from '@/lib/domain/payments/publicSession'
import { buildOrderFollowPath } from '@/lib/domain/orders/followLink'
import { buildTransferWhatsAppMessage } from '@/lib/domain/orders/whatsappMessage'
import { openWhatsApp } from '@/lib/whatsappLink'
import {
  getPublicPaymentAction,
  startBankTransferAction,
  startMercadoPagoAction,
  uploadTransferReceiptAction,
} from '@/app/actions/payments'
import type { PublicPaymentView } from '@/lib/domain/payments/types'

function statusLabel(status: string | null): string {
  if (!status) return 'Pendiente de pago'
  return paymentStatusLabel(status as PaymentStatus)
}

function hasBankDetails(bank: PublicPaymentView['bank']): boolean {
  if (!bank) return false
  return Boolean(bank.cbu || bank.alias || bank.bank_name || bank.account_holder || bank.cuit || bank.instructions)
}

export function PedidoPagoClient() {
  const [view, setView] = useState<PublicPaymentView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [access, setAccess] = useState<string>('')
  const [pending, startTransition] = useTransition()
  const [fileError, setFileError] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  function refresh(capability: string) {
    startTransition(async () => {
      const result = await getPublicPaymentAction(capability)
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
    const stored = loadOrderAccess()
    startTransition(async () => {
      if (!stored) {
        setError('No encontramos un pedido abierto en este navegador.')
        return
      }
      const follow = storedFollow(stored)
      if (follow && stored.orderNumber) {
        window.location.replace(buildOrderFollowPath(stored.orderNumber, follow))
        return
      }
      setAccess(stored.access)
      const result = await getPublicPaymentAction(stored.access)
      if (!result.ok) {
        setError(result.error)
        setView(null)
        return
      }
      setError(null)
      setView(result.data)
    })
  }, [])

  function startTransfer(rotateKey: boolean) {
    if (!access) return
    startTransition(async () => {
      const result = await startBankTransferAction(access, paymentStartKey('bank_transfer', rotateKey))
      if (!result.ok) {
        setError(result.error)
        return
      }
      refresh(access)
    })
  }

  function startMercadoPago(rotateKey: boolean) {
    if (!access) return
    startTransition(async () => {
      const result = await startMercadoPagoAction(access, paymentStartKey('mercado_pago', rotateKey))
      if (!result.ok) {
        setError(result.error)
        return
      }
      window.location.assign(result.data.checkout_url)
    })
  }

  function onFile(form: FormData) {
    if (!access) return
    setFileError(null)
    startTransition(async () => {
      const result = await uploadTransferReceiptAction(access, form)
      if (!result.ok) {
        setFileError(result.error)
        return
      }
      refresh(access)
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
  const publicAmount = view?.amount_due && view.method === 'mercado_pago'
    ? view.amount_due
    : view?.quoted_public_amount ?? null
  const showMethodChoice = Boolean(view && !view.payment_status)
  const showRetryTransfer = Boolean(view?.can_retry && view.transfer_available)
  const showRetryMp = Boolean(view?.can_retry && view.mp_available)

  return (
    <main className="mx-auto max-w-xl px-4 py-8 sm:py-12 text-[#1A181E] dark:text-[#F6EEF3]">
      
      {/* Header Banner */}
      <div className="rounded-3xl border border-[#EBE4DA] bg-white p-6 sm:p-8 shadow-sm dark:border-white/10 dark:bg-[#1C1924]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#C5A880]">
              Pasarela de Pago Segura
            </p>
            <h1 className="mt-1 font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#1A181E] dark:text-[#F6EEF3]">
              {view?.order_number || 'Pedido'}
            </h1>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-pink-200 bg-[#FDF2F4] px-3.5 py-1 text-xs font-bold text-[#C25B6C] dark:border-pink-900/40 dark:bg-pink-950/30 dark:text-[#F472B6]">
            <span>●</span>
            <span>{statusLabel(view?.payment_status ?? null)}</span>
          </span>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm font-semibold text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200" role="alert">
            {error}
          </p>
        )}

        {view && (
          <section className="mt-6 flex flex-col gap-5">
            
            {/* Method Choices: MP & Transfer */}
            {showMethodChoice && (
              <div className="flex flex-col gap-4">
                <p className="text-xs font-extrabold uppercase tracking-wider text-[#635F6A] dark:text-[#A8A3B0]">
                  {PUBLIC_PAYMENT_COPY.choosePayment}
                </p>

                {/* Option 1: Mercado Pago */}
                {view.mp_available && publicAmount != null && (
                  <div className="group rounded-2xl border-2 border-[#009EE3]/30 bg-gradient-to-b from-[#E6F7FF]/50 to-white p-5 shadow-sm transition-all hover:border-[#009EE3] hover:shadow-md dark:from-[#00364F]/30 dark:to-[#1C1924]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#009EE3] text-white">
                          <Zap className="h-5 w-5" />
                        </div>
                        <div>
                          <strong className="block text-base font-bold text-gray-900 dark:text-white">
                            Mercado Pago
                          </strong>
                          <span className="text-xs text-gray-500 dark:text-zinc-400">
                            Tarjetas, Débito, Dinero en cuenta
                          </span>
                        </div>
                      </div>
                      <span className="rounded-full bg-[#E6F7FF] px-2.5 py-0.5 text-xs font-bold text-[#007EB5] dark:bg-[#00364F] dark:text-[#00B2FF]">
                        ⚡ Instantáneo
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-zinc-300">
                      <span className="inline-flex items-center gap-1 rounded bg-black/5 px-2 py-0.5 dark:bg-white/10">
                        <CreditCard className="h-3.5 w-3.5" /> Hasta 3 cuotas
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-black/5 px-2 py-0.5 dark:bg-white/10">
                        <ShieldCheck className="h-3.5 w-3.5" /> Pago protegido
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => startMercadoPago(Boolean(error))}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#009EE3] to-[#007EB5] py-3.5 font-bold text-white shadow-md shadow-[#009EE3]/25 transition-all hover:brightness-105 disabled:opacity-60"
                      data-testid="pay-mercadopago"
                    >
                      {pending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <span>Pagar con Mercado Pago · ${formatPesoARExact(publicAmount)}</span>
                          <ExternalLink className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Option 2: Bank Transfer */}
                {transferAmount != null && (
                  <div className="rounded-2xl border-2 border-pink-200/80 bg-gradient-to-b from-[#FDF2F4]/40 to-white p-5 shadow-sm transition-all hover:border-[#D97786] hover:shadow-md dark:border-pink-900/40 dark:from-[#2D1823]/30 dark:to-[#1C1924]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D97786] text-white">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <strong className="block text-base font-bold text-gray-900 dark:text-white">
                            Transferencia Bancaria
                          </strong>
                          <span className="text-xs font-semibold text-[#1E9E68] dark:text-[#34D399]">
                            ✨ 10% OFF EXTRA acumulado
                          </span>
                        </div>
                      </div>
                      <span className="rounded-full bg-[#FDF2F4] px-2.5 py-0.5 text-xs font-extrabold text-[#C25B6C] dark:bg-[#2D1823] dark:text-[#F472B6]">
                        ${formatPesoARExact(transferAmount)}
                      </span>
                    </div>

                    {view.transfer_available ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => startTransfer(Boolean(error))}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#D97786] bg-white py-3 font-bold text-[#C25B6C] transition-all hover:bg-[#D97786] hover:text-white disabled:opacity-60 dark:bg-transparent dark:text-[#F472B6]"
                        data-testid="pay-transfer"
                      >
                        <span>Ver datos bancarios y transferir</span>
                      </button>
                    ) : (
                      <div className="mt-4 rounded-xl border border-pink-100 bg-[#FAF8F5] p-3.5 text-xs dark:border-zinc-800 dark:bg-zinc-900/50">
                        <p className="text-gray-600 dark:text-zinc-300">
                          Escribinos por WhatsApp y te pasamos el Alias al instante para transferir.
                        </p>
                        <button
                          type="button"
                          className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white"
                          data-testid="pay-transfer-whatsapp"
                          onClick={() => {
                            const ok = openWhatsApp(buildTransferWhatsAppMessage({
                              order_number: view.order_number,
                              amount: transferAmount,
                            }), false)
                            if (!ok) setError('No se pudo abrir WhatsApp. Tu pedido ya está registrado.')
                          }}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          <span>Pedir datos por WhatsApp</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Mercado Pago Pending */}
            {view.method === 'mercado_pago' && view.payment_status === 'pending' && (
              <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-5 dark:border-sky-900/40 dark:bg-sky-950/20">
                <p className="text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300">
                  Total a pagar en Mercado Pago
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
                    disabled={pending}
                    onClick={() => startMercadoPago(true)}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#009EE3] py-3.5 font-bold text-white"
                  >
                    Reintentar pago
                  </button>
                )}
                <p className="mt-2.5 text-xs text-gray-500 dark:text-zinc-400">{PUBLIC_PAYMENT_COPY.returnInformative}</p>
              </div>
            )}

            {/* Bank Transfer Details with 1-Click Copy */}
            {view.method === 'bank_transfer' && (
              <div className="rounded-2xl border border-[#EBE4DA] bg-white p-5 dark:border-white/10 dark:bg-[#1C1924]">
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
                    action={(formData) => onFile(formData)}
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
                      <span>{view.has_receipt ? 'Reemplazar comprobante' : 'Subir comprobante'}</span>
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Retries */}
            {(showRetryTransfer || showRetryMp) && (
              <div className="flex flex-col gap-2">
                {showRetryMp && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => startMercadoPago(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#009EE3] py-3 text-sm font-bold text-white shadow-sm"
                  >
                    Intentar de nuevo con Mercado Pago
                  </button>
                )}
                {showRetryTransfer && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => startTransfer(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-pink-200 py-3 text-sm font-bold text-[#C25B6C]"
                  >
                    Intentar de nuevo por transferencia
                  </button>
                )}
              </div>
            )}

          </section>
        )}

        <div className="mt-8 flex justify-center border-t border-[#EBE4DA] pt-4 dark:border-white/10">
          <Link
            href="/catalogo"
            className="text-xs font-bold uppercase tracking-wider text-[#C25B6C] hover:underline dark:text-[#F472B6]"
          >
            ← Volver al catálogo de productos
          </Link>
        </div>
      </div>
    </main>
  )
}
