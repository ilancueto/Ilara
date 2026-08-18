import { getBrowserSupabase } from '@/lib/supabase/browser'
import { AppError, mapRpcMessageToAppError } from '@/lib/domain/errors'
import { mapPublicPricingContext } from '@/lib/domain/payments/mappers'
import type { PricingPreview, PricingVersion, PublicPricingContext } from '@/lib/domain/payments/types'
import { mapPaymentOpsBoard } from '@/lib/domain/payments/finance'

export { mapPublicPricingContext }

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

const num = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function mapVersion(raw: unknown): PricingVersion {
  const v = record(raw)
  return {
    id: String(v.id ?? ''),
    version_number: num(v.version_number),
    status: v.status === 'draft' || v.status === 'superseded' ? v.status : 'active',
    transfer_discount_rate:
      v.transfer_discount_rate == null ? 0.10 : num(v.transfer_discount_rate),
    effective_fee_rate: num(v.effective_fee_rate),
    rounding_increment: num(v.rounding_increment),
    listed_fee_rate: v.listed_fee_rate == null ? null : num(v.listed_fee_rate),
    iva_rate: v.iva_rate == null ? null : num(v.iva_rate),
    mp_reservation_minutes: num(v.mp_reservation_minutes),
    transfer_reservation_hours: num(v.transfer_reservation_hours),
    payments_enabled: v.payments_enabled === true,
    mercado_pago_enabled: v.mercado_pago_enabled === true,
    bank_transfer_enabled: v.bank_transfer_enabled === true,
    catalog_dual_price_visible: v.catalog_dual_price_visible === true,
    bank_cbu: v.bank_cbu == null ? null : String(v.bank_cbu),
    bank_alias: v.bank_alias == null ? null : String(v.bank_alias),
    bank_name: v.bank_name == null ? null : String(v.bank_name),
    bank_account_holder: v.bank_account_holder == null ? null : String(v.bank_account_holder),
    bank_cuit: v.bank_cuit == null ? null : String(v.bank_cuit),
    bank_instructions: v.bank_instructions == null ? null : String(v.bank_instructions),
    receipt_required: v.receipt_required !== false,
    notes: v.notes == null ? null : String(v.notes),
    activated_by: v.activated_by == null ? null : String(v.activated_by),
    activated_at: v.activated_at == null ? null : String(v.activated_at),
    created_at: String(v.created_at ?? ''),
  }
}

export async function fetchPublicPricingContext(): Promise<PublicPricingContext> {
  const { data, error } = await getBrowserSupabase().rpc('payment_public_pricing_context')
  if (error) {
    return mapPublicPricingContext(null)
  }
  return mapPublicPricingContext(data)
}

function throwRpc(error: { message?: string } | null): never {
  const message = error?.message || 'pricing_rpc_failed'
  if (message.includes('payment_method_requires_payments')) {
    throw new AppError('validation', 'Primero habilitá los cobros online.', { message })
  }
  if (message.includes('payment_methods_required')) {
    throw new AppError('validation', 'Elegí al menos un medio de cobro.', { message })
  }
  if (message.includes('bank_details_required')) {
    throw new AppError('validation', 'Completá los datos de la cuenta para recibir transferencias.', { message })
  }
  const mapped = mapRpcMessageToAppError(message)
  if (mapped.code !== 'unknown') throw mapped
  throw new AppError('unknown', 'No se pudo completar la operación.', {
    message,
  })
}

export async function listPricingVersions(): Promise<PricingVersion[]> {
  const { data, error } = await getBrowserSupabase().rpc('payment_admin_list_versions')
  if (error) throwRpc(error)
  return Array.isArray(data) ? data.map(mapVersion) : []
}

export async function previewPricing(versionId?: string | null): Promise<PricingPreview> {
  const { data, error } = await getBrowserSupabase().rpc('payment_admin_preview_pricing', {
    p_version_id: versionId ?? null,
  })
  if (error) throwRpc(error)
  const raw = record(data)
  const version = mapVersion(raw.version)
  const samples = Array.isArray(raw.samples)
    ? raw.samples.map((item) => {
      const row = record(item)
      const transfer = num(row.transfer_price)
      const pub = num(row.public_price)
      return {
        kind: row.kind === 'combo' ? 'combo' as const : 'product' as const,
        id: num(row.id),
        name: String(row.name ?? ''),
        sale_price: num(row.sale_price),
        discount_percentage: num(row.discount_percentage),
        transfer_price: transfer,
        public_price: pub,
        saving: pub - transfer,
      }
    })
    : []
  return {
    version,
    affected_products: num(raw.affected_products),
    affected_combos: num(raw.affected_combos),
    samples,
  }
}

export async function savePricingDraft(payload: Record<string, unknown>): Promise<PricingVersion> {
  const { data, error } = await getBrowserSupabase().rpc('payment_admin_save_draft', {
    p_payload: payload,
  })
  if (error) throwRpc(error)
  return mapVersion(data)
}

export async function fetchPaymentOpsBoard() {
  const { data, error } = await getBrowserSupabase().rpc('admin_payment_ops_board')
  if (error) throwRpc(error)
  return mapPaymentOpsBoard(data)
}

export async function activatePricingVersion(versionId: string): Promise<PricingVersion> {
  const { data, error } = await getBrowserSupabase().rpc('payment_admin_activate_version', {
    p_version_id: versionId,
  })
  if (error) throwRpc(error)
  return mapVersion(data)
}
