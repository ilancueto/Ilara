/**
 * Motor de precios Stage 8 (puro). Espejo de UX/tests.
 * La autoridad es Postgres: public.payment_public_price / payment_quote_totals.
 */
import { couponDiscountFromPercent, priceWithProductDiscount } from '@/lib/catalogPricing'

export const DEFAULT_EFFECTIVE_FEE_RATE = 0.053119
export const DEFAULT_ROUNDING_INCREMENT = 100
export const FEE_RATE_SCALE = 100_000_000

export type PricingRates = {
  effective_fee_rate: number
  rounding_increment: number
}

export type PricedMoney = {
  base: number
  public: number
  transfer: number
  saving: number
}

export type QuoteLineInput = {
  line_type: 'product' | 'combo'
  unit_sale_price: number
  discount_percentage?: number | null
  quantity: number
}

export type OrderQuoteInput = {
  lines: QuoteLineInput[]
  coupon_percent?: number | null
  shipping_base?: number | null
  rates?: PricingRates
}

export type OrderQuote = {
  rates: PricingRates
  lines: Array<PricedMoney & { quantity: number; unit_base: number; unit_public: number }>
  subtotal: PricedMoney
  coupon: PricedMoney
  shipping: PricedMoney
  total: PricedMoney
}

export function assertPricingRates(rates: PricingRates): void {
  if (!Number.isFinite(rates.effective_fee_rate) || rates.effective_fee_rate < 0 || rates.effective_fee_rate >= 1) {
    throw new Error('invalid_fee_rate')
  }
  if (!Number.isFinite(rates.rounding_increment) || rates.rounding_increment <= 0) {
    throw new Error('invalid_rounding_increment')
  }
}

function toCents(amount: number): bigint {
  if (!Number.isFinite(amount)) throw new Error('invalid_amount')
  return BigInt(Math.round(amount * 100))
}

function fromCents(cents: bigint): number {
  return Number(cents) / 100
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  const zero = BigInt(0)
  const one = BigInt(1)
  if (denominator <= zero) throw new Error('invalid_rounding_increment')
  if (numerator <= zero) return zero
  return (numerator + denominator - one) / denominator
}

/** Techo al próximo múltiplo de `increment` usando aritmética entera. */
export function ceilToIncrement(amount: number, increment: number): number {
  if (amount <= 0) return 0
  const incrementCents = toCents(increment)
  return fromCents(ceilDiv(toCents(amount), incrementCents) * incrementCents)
}

/**
 * public = ceil(base / (1 - fee) / increment) * increment
 * Escala de tasa: 8 decimales (numeric(12,8)).
 */
export function publicPriceFromBase(
  base: number,
  feeRate: number = DEFAULT_EFFECTIVE_FEE_RATE,
  increment: number = DEFAULT_ROUNDING_INCREMENT
): number {
  assertPricingRates({ effective_fee_rate: feeRate, rounding_increment: increment })
  if (!Number.isFinite(base) || base < 0) throw new Error('invalid_amount')
  if (base === 0) return 0

  const feeScaled = BigInt(Math.round(feeRate * FEE_RATE_SCALE))
  const denom = BigInt(FEE_RATE_SCALE) - feeScaled
  if (denom <= BigInt(0)) throw new Error('invalid_fee_rate')

  const rawCents = ceilDiv(toCents(base) * BigInt(FEE_RATE_SCALE), denom)
  const incrementCents = toCents(increment)
  return fromCents(ceilDiv(rawCents, incrementCents) * incrementCents)
}

export function pricedFromBase(base: number, rates?: PricingRates): PricedMoney {
  const fee = rates?.effective_fee_rate ?? DEFAULT_EFFECTIVE_FEE_RATE
  const increment = rates?.rounding_increment ?? DEFAULT_ROUNDING_INCREMENT
  const roundedBase = Math.round(base)
  const pub = publicPriceFromBase(roundedBase, fee, increment)
  return {
    base: roundedBase,
    public: pub,
    transfer: roundedBase,
    saving: pub - roundedBase,
  }
}

export function lineBaseUnit(unitSalePrice: number, discountPercentage?: number | null): number {
  return priceWithProductDiscount(unitSalePrice, discountPercentage)
}

export function quoteOrderTotals(input: OrderQuoteInput): OrderQuote {
  const rates = input.rates ?? {
    effective_fee_rate: DEFAULT_EFFECTIVE_FEE_RATE,
    rounding_increment: DEFAULT_ROUNDING_INCREMENT,
  }
  assertPricingRates(rates)

  const lines = input.lines.map((line) => {
    const unit_base =
      line.line_type === 'combo'
        ? Math.round(line.unit_sale_price)
        : lineBaseUnit(line.unit_sale_price, line.discount_percentage)
    const unit_public = publicPriceFromBase(unit_base, rates.effective_fee_rate, rates.rounding_increment)
    const quantity = line.quantity
    const base = unit_base * quantity
    const pub = unit_public * quantity
    return {
      quantity,
      unit_base,
      unit_public,
      base,
      public: pub,
      transfer: base,
      saving: pub - base,
    }
  })

  const subtotalBase = lines.reduce((sum, line) => sum + line.base, 0)
  const subtotalPublic = lines.reduce((sum, line) => sum + line.public, 0)
  const couponPercent = input.coupon_percent ?? 0
  const couponBase = couponDiscountFromPercent(subtotalBase, couponPercent)
  const couponPublic = couponDiscountFromPercent(subtotalPublic, couponPercent)
  const shippingBase = Math.round(((input.shipping_base ?? 0) + Number.EPSILON) * 100) / 100
  const shippingPublic =
    shippingBase > 0
      ? publicPriceFromBase(shippingBase, rates.effective_fee_rate, rates.rounding_increment)
      : 0

  const totalBase = Math.max(0, subtotalBase - couponBase) + shippingBase
  const totalPublic = Math.max(0, subtotalPublic - couponPublic) + shippingPublic

  const pack = (base: number, pub: number): PricedMoney => ({
    base,
    public: pub,
    transfer: base,
    saving: pub - base,
  })

  return {
    rates,
    lines,
    subtotal: pack(subtotalBase, subtotalPublic),
    coupon: pack(couponBase, couponPublic),
    shipping: pack(shippingBase, shippingPublic),
    total: pack(totalBase, totalPublic),
  }
}

export function transferSavingLabel(saving: number): string {
  if (saving <= 0) return ''
  return `Ahorrás`
}
