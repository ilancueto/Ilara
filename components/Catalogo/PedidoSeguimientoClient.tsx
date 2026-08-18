'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { formatPesoARExact } from '@/lib/formatPesoAR'
import { PUBLIC_PAYMENT_COPY } from '@/lib/domain/payments/labels'
import { paymentStatusLabel, type PaymentStatus } from '@/lib/domain/payments/states'
import { fulfillmentPublicLine } from '@/lib/domain/orders/fulfillment'
import { buildTransferWhatsAppMessage } from '@/lib/domain/orders/whatsappMessage'
import { openWhatsApp } from '@/lib/whatsappLink'
import {
  getFollowOrderAction,
  startFollowBankTransferAction,
  startFollowMercadoPagoAction,
  uploadFollowTransferReceiptAction,
} from '@/app/actions/payments'
import type { PublicFollowView } from '@/lib/domain/payments/types'

function statusLabel(status: string | null): string {
  if (!status) return 'Todavía no hay un pago iniciado'
  return paymentStatusLabel(status as PaymentStatus)
}

function hasBankDetails(bank: PublicFollowView['bank']): boolean {
  if (!bank) return false
  return Boolean(bank.cbu || bank.alias || bank.bank_name || bank.account_holder || bank.cuit || bank.instructions)
}

function orderStatusCopy(status: string): string {
  if (status === 'pending') return 'Pedido recibido'
  if (status === 'confirmed') return 'Pedido confirmado'
  if (status === 'preparing') return 'Lo estamos preparando'
  if (status === 'ready') return 'Listo'
  if (status === 'completed') return 'Entregado'
  if (status === 'cancelled') return 'Cancelado'
  return status
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

  function onFile(form: FormData) {
    setFileError(null)
    startTransition(async () => {
      const result = await uploadFollowTransferReceiptAction(orderNumber, form)
      if (!result.ok) {
        setFileError(result.error)
        return
      }
      refresh()
    })
  }

  const transferAmount = view?.amount_due && view.method === 'bank_transfer'
    ? view.amount_due
    : view?.quoted_base_amount ?? view?.base_amount ?? null
  const showMethodChoice = Boolean(view && !view.payment_status)
  const showRetryTransfer = Boolean(view?.can_retry && view.transfer_available)

  return (
    <main className="mx-auto max-w-xl px-4 py-10 text-[#1A181E] dark:text-zinc-50">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#A98C64]">Tu pedido</p>
      <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight">{view?.order_number || orderNumber}</h1>
      {error && (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200" role="alert">
          {error}
        </p>
      )}
      {view && (
        <section className="mt-6 flex flex-col gap-4">
          <p className="text-sm font-semibold">{orderStatusCopy(view.order_status)}</p>
          <p className="text-sm text-[#635F69] dark:text-zinc-300">
            {fulfillmentPublicLine({
              mode: view.fulfillment_mode,
              carrier: view.shipping_carrier,
              service: view.shipping_service,
              estimate: view.shipping_delivery_estimate,
            })}
            {view.fulfillment_mode === 'envio' && view.shipping_amount > 0
              ? ` · $${formatPesoARExact(view.shipping_amount)}`
              : ''}
          </p>
          <p className="text-sm text-[#635F69] dark:text-zinc-300">{statusLabel(view.payment_status)}</p>
          {showMethodChoice && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold">{PUBLIC_PAYMENT_COPY.choosePayment}</p>
              {view.mp_available && view.quoted_public_amount != null && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={startMercadoPago}
                  className="rounded-xl bg-gradient-to-br from-[#CF6B7F] to-[#B85064] px-4 py-3 font-bold text-white disabled:opacity-60"
                  data-testid="pay-mercadopago"
                >
                  {PUBLIC_PAYMENT_COPY.mercadoPago} · ${formatPesoARExact(view.quoted_public_amount)}
                </button>
              )}
              {transferAmount != null && (
                view.transfer_available ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={startTransfer}
                    className="rounded-xl border border-pink-200 px-4 py-3 font-bold disabled:opacity-60"
                  >
                    {PUBLIC_PAYMENT_COPY.bankTransfer} · ${formatPesoARExact(transferAmount)}
                  </button>
                ) : (
                  <div className="rounded-2xl border border-pink-100 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="font-semibold">
                      {PUBLIC_PAYMENT_COPY.bankTransfer} · ${formatPesoARExact(transferAmount)}
                    </p>
                    <p className="mt-2 text-gray-600 dark:text-zinc-300">
                      Con transferencia tenés 10% off en productos. Todavía no publicamos los datos de la cuenta: escribinos y te pasamos alias o CBU.
                    </p>
                    <button
                      type="button"
                      className="mt-3 rounded-xl border border-pink-200 px-4 py-2 font-bold"
                      onClick={() => {
                        const ok = openWhatsApp(buildTransferWhatsAppMessage({
                          order_number: view.order_number,
                          amount: transferAmount,
                        }), false)
                        if (!ok) setError('No se pudo abrir WhatsApp. Tu pedido ya está registrado.')
                      }}
                    >
                      Pedir datos por WhatsApp
                    </button>
                  </div>
                )
              )}
            </div>
          )}
          {view.method === 'mercado_pago' && view.payment_status === 'pending' && (
            <div className="flex flex-col gap-2">
              {view.amount_due != null && (
                <p className="text-2xl font-extrabold tabular-nums">${formatPesoARExact(view.amount_due)}</p>
              )}
              {view.checkout_url && (
                <a href={view.checkout_url} className="rounded-xl bg-gradient-to-br from-[#CF6B7F] to-[#B85064] px-4 py-3 text-center font-bold text-white">
                  Continuar el pago
                </a>
              )}
              <p className="text-sm text-[#635F69] dark:text-zinc-300">{PUBLIC_PAYMENT_COPY.returnInformative}</p>
            </div>
          )}
          {view.method === 'bank_transfer' && transferAmount != null && (
            <p className="text-2xl font-extrabold tabular-nums">${formatPesoARExact(transferAmount)}</p>
          )}
          {view.method === 'bank_transfer' && (
            <div className="rounded-2xl border border-pink-100 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
              <p className="font-semibold">{PUBLIC_PAYMENT_COPY.transferInstructions}</p>
              {hasBankDetails(view.bank) ? (
                <dl className="mt-3 grid gap-2">
                  {view.bank?.account_holder && <div><dt className="text-gray-400">Titular</dt><dd>{view.bank.account_holder}</dd></div>}
                  {view.bank?.bank_name && <div><dt className="text-gray-400">Banco</dt><dd>{view.bank.bank_name}</dd></div>}
                  {view.bank?.alias && <div><dt className="text-gray-400">Alias</dt><dd>{view.bank.alias}</dd></div>}
                  {view.bank?.cbu && <div><dt className="text-gray-400">CBU</dt><dd className="break-all">{view.bank.cbu}</dd></div>}
                  {view.bank?.cuit && <div><dt className="text-gray-400">CUIT</dt><dd>{view.bank.cuit}</dd></div>}
                  {view.bank?.instructions && <div><dt className="text-gray-400">Indicaciones</dt><dd>{view.bank.instructions}</dd></div>}
                </dl>
              ) : (
                <p className="mt-3 text-gray-600 dark:text-zinc-300">
                  En breve te pasamos los datos de la cuenta para que puedas transferir.
                </p>
              )}
            </div>
          )}
          {view.method === 'bank_transfer' && view.payment_status && ['pending', 'requires_review'].includes(view.payment_status) && (
            <form className="flex flex-col gap-2" action={(formData) => onFile(formData)}>
              <label className="text-sm font-semibold" htmlFor="comprobante">
                Comprobante
              </label>
              <input id="comprobante" name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required />
              {fileError && <p className="text-sm text-rose-700">{fileError}</p>}
              <button type="submit" disabled={pending} className="rounded-xl border border-gray-300 px-4 py-2 font-bold disabled:opacity-60">
                {view.has_receipt ? 'Reemplazar comprobante' : 'Enviar comprobante'}
              </button>
            </form>
          )}
          {view.payment_status === 'requires_review' && <p>{PUBLIC_PAYMENT_COPY.paymentPendingReview}</p>}
          {showRetryTransfer && (
            <button type="button" disabled={pending} onClick={startTransfer} className="rounded-xl border border-pink-200 px-4 py-3 font-bold">
              Intentar de nuevo por transferencia
            </button>
          )}
        </section>
      )}
      <p className="mt-8">
        <Link href="/catalogo" className="text-pink-700 underline">
          Volver al catálogo
        </Link>
      </p>
    </main>
  )
}
