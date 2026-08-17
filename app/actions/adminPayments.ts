'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { toUserMessage } from '@/lib/domain/errors'

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

export type AdminOrderPayment = {
  id: string
  method: string
  status: string
  amount_due: number | null
  base_amount: number | null
  public_amount: number | null
  transfer_saving: number | null
  price_uplift: number | null
  estimated_fee: number | null
  expires_at: string | null
  approved_at: string | null
  rejected_at: string | null
  reject_reason: string | null
  has_receipt: boolean
}

function mapAdminPayment(raw: unknown): AdminOrderPayment | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (!row.id) return null
  return {
    id: String(row.id),
    method: String(row.method || ''),
    status: String(row.status || ''),
    amount_due: row.amount_due == null ? null : Number(row.amount_due),
    base_amount: row.base_amount == null ? null : Number(row.base_amount),
    public_amount: row.public_amount == null ? null : Number(row.public_amount),
    transfer_saving: row.transfer_saving == null ? null : Number(row.transfer_saving),
    price_uplift: row.price_uplift == null ? null : Number(row.price_uplift),
    estimated_fee: row.estimated_fee == null ? null : Number(row.estimated_fee),
    expires_at: row.expires_at == null ? null : String(row.expires_at),
    approved_at: row.approved_at == null ? null : String(row.approved_at),
    rejected_at: row.rejected_at == null ? null : String(row.rejected_at),
    reject_reason: row.reject_reason == null ? null : String(row.reject_reason),
    has_receipt: row.has_receipt === true,
  }
}

export async function adminReviewTransferAction(
  paymentId: string,
  action: 'approve' | 'reject',
  reason?: string
): Promise<ActionResult<{ status: string }>> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.rpc('admin_review_transfer_payment', {
      p_payment_id: paymentId,
      p_action: action,
      p_reason: reason ?? null,
    })
    if (error) return { ok: false, error: toUserMessage(error, 'No se pudo actualizar el pago.') }
    const row = data && typeof data === 'object' ? data as { status?: string } : {}
    return { ok: true, data: { status: String(row.status || action) } }
  } catch (error) {
    return { ok: false, error: toUserMessage(error, 'No se pudo actualizar el pago.') }
  }
}

export async function adminOrderPaymentsAction(orderId: string): Promise<ActionResult<AdminOrderPayment[]>> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.rpc('admin_order_payments', { p_order_id: orderId })
    if (error) return { ok: false, error: toUserMessage(error, 'No se pudieron cargar los pagos.') }
    const rows = Array.isArray(data) ? data.map(mapAdminPayment).filter((row): row is AdminOrderPayment => row != null) : []
    return { ok: true, data: rows }
  } catch (error) {
    return { ok: false, error: toUserMessage(error, 'No se pudieron cargar los pagos.') }
  }
}

export async function adminReceiptSignedUrlAction(paymentId: string): Promise<ActionResult<string>> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.rpc('admin_payment_receipt_path', { p_payment_id: paymentId })
    if (error || !data) return { ok: false, error: 'No hay comprobante para este pago.' }
    const service = createSupabaseServiceClient()
    const signed = await service.storage.from('payment-receipts').createSignedUrl(String(data), 120)
    if (signed.error || !signed.data?.signedUrl) {
      return { ok: false, error: 'No se pudo abrir el comprobante.' }
    }
    return { ok: true, data: signed.data.signedUrl }
  } catch (error) {
    return { ok: false, error: toUserMessage(error, 'No se pudo abrir el comprobante.') }
  }
}
