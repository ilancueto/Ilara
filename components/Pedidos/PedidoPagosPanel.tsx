'use client'

import { useState, useTransition } from 'react'
import {
  adminOrderPaymentsAction,
  adminReceiptSignedUrlAction,
  adminReviewTransferAction,
  type AdminOrderPayment,
} from '@/app/actions/adminPayments'
import { paymentMethodLabel, paymentStatusLabel, type PaymentMethodCode, type PaymentStatus } from '@/lib/domain/payments/states'
import { formatPesoARExact } from '@/lib/formatPesoAR'

type Props = {
  orderId: string
  payments: AdminOrderPayment[]
  onChange: (payments: AdminOrderPayment[]) => void
}

export function PedidoPagosPanel({ orderId, payments, onChange }: Props) {
  const [pending, startTransition] = useTransition()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    const next = await adminOrderPaymentsAction(orderId)
    if (next.ok) onChange(next.data)
  }

  function review(paymentId: string, action: 'approve' | 'reject') {
    setError(null)
    if (action === 'reject' && reason.trim().length < 3) {
      setError('Indicá el motivo del rechazo.')
      return
    }
    startTransition(async () => {
      const result = await adminReviewTransferAction(
        paymentId,
        action,
        action === 'reject' ? reason.trim() : undefined
      )
      if (!result.ok) {
        setError(result.error)
        return
      }
      setReason('')
      await reload()
    })
  }

  function openReceipt(paymentId: string) {
    setError(null)
    startTransition(async () => {
      const result = await adminReceiptSignedUrlAction(paymentId)
      if (!result.ok) {
        setError(result.error)
        return
      }
      window.open(result.data, '_blank', 'noopener,noreferrer')
    })
  }

  if (payments.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 px-3 py-2 text-sm text-gray-500 dark:border-gray-800">
        Todavía no hay pagos asociados a este pedido.
      </div>
    )
  }

  return (
    <div className="space-y-3" data-testid="pedido-pagos">
      {error && (
        <p className="text-sm text-rose-700" role="alert">{error}</p>
      )}
      {payments.map((payment) => {
        const reviewable =
          payment.method === 'bank_transfer' &&
          ['pending', 'requires_review'].includes(payment.status)
        return (
          <article
            key={payment.id}
            className="rounded-xl border border-gray-100 px-3 py-3 text-sm dark:border-gray-800"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-bold">
                {paymentMethodLabel((payment.method || 'bank_transfer') as PaymentMethodCode)}
              </p>
              <p>{paymentStatusLabel((payment.status || 'pending') as PaymentStatus)}</p>
            </div>
            <p className="mt-1 tabular-nums">
              Importe: ${formatPesoARExact(payment.amount_due ?? payment.base_amount ?? 0)}
            </p>
            {payment.reject_reason && (
              <p className="mt-1 text-rose-700">Motivo: {payment.reject_reason}</p>
            )}
            {payment.has_receipt && (
              <button
                type="button"
                className="mt-2 text-pink-700 underline"
                disabled={pending}
                onClick={() => openReceipt(payment.id)}
              >
                Ver comprobante
              </button>
            )}
            {reviewable && (
              <div className="mt-3 space-y-2">
                <label className="block text-xs font-bold" htmlFor={`reject-${payment.id}`}>
                  Motivo si rechazás
                </label>
                <textarea
                  id={`reject-${payment.id}`}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 dark:border-gray-700 dark:bg-gray-950"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending || !payment.has_receipt}
                    onClick={() => review(payment.id, 'approve')}
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                  >
                    Aprobar transferencia
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => review(payment.id, 'reject')}
                    className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}
