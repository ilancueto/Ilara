import type { PublicPricingContext } from '@/lib/domain/payments/types'

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

const num = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function mapPublicPricingContext(raw: unknown): PublicPricingContext {
  const v = record(raw)
  if (v.catalog_dual_price_visible !== true) {
    return {
      catalog_dual_price_visible: false,
      version_id: null,
      effective_fee_rate: null,
      rounding_increment: null,
    }
  }
  return {
    catalog_dual_price_visible: true,
    version_id: v.version_id == null ? null : String(v.version_id),
    effective_fee_rate: v.effective_fee_rate == null ? null : num(v.effective_fee_rate),
    rounding_increment: v.rounding_increment == null ? null : num(v.rounding_increment),
  }
}
