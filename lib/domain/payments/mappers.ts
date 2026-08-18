import type { PublicPricingContext } from '@/lib/domain/payments/types'

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

const num = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function mapPublicPricingContext(raw: unknown): PublicPricingContext {
  const v = record(raw)
  const hasVersion = v.version_id != null || v.transfer_discount_rate != null
  if (!hasVersion) {
    return {
      catalog_dual_price_visible: false,
      mercado_pago_enabled: false,
      bank_transfer_enabled: false,
      version_id: null,
      transfer_discount_rate: null,
      effective_fee_rate: null,
      rounding_increment: null,
    }
  }
  return {
    catalog_dual_price_visible: v.catalog_dual_price_visible === true,
    mercado_pago_enabled: v.mercado_pago_enabled === true,
    bank_transfer_enabled: v.bank_transfer_enabled === true,
    version_id: v.version_id == null ? null : String(v.version_id),
    transfer_discount_rate:
      v.transfer_discount_rate == null ? 0.10 : num(v.transfer_discount_rate),
    effective_fee_rate: v.effective_fee_rate == null ? null : num(v.effective_fee_rate),
    rounding_increment: v.rounding_increment == null ? null : num(v.rounding_increment),
  }
}
