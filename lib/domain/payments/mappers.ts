import type { PublicPricingContext } from '@/lib/domain/payments/types'

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

const num = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function mapPublicPricingContext(raw: unknown): PublicPricingContext {
  const v = record(raw)
  const hasRates = v.effective_fee_rate != null && v.rounding_increment != null
  if (!hasRates) {
    return {
      catalog_dual_price_visible: false,
      mercado_pago_enabled: false,
      version_id: null,
      effective_fee_rate: null,
      rounding_increment: null,
    }
  }
  return {
    catalog_dual_price_visible: v.catalog_dual_price_visible === true,
    mercado_pago_enabled: v.mercado_pago_enabled === true,
    version_id: v.version_id == null ? null : String(v.version_id),
    effective_fee_rate: num(v.effective_fee_rate),
    rounding_increment: num(v.rounding_increment),
  }
}
