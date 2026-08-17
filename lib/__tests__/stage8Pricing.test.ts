import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DEFAULT_EFFECTIVE_FEE_RATE,
  DEFAULT_ROUNDING_INCREMENT,
  ceilToIncrement,
  pricedFromBase,
  publicPriceFromBase,
  quoteOrderTotals,
} from '../domain/payments/pricing'
import { applyProductPublicPricing } from '../domain/payments/applyPublicPricing'
import { bankTransferSecondaryLine, INTERNAL_WORDS_FORBIDDEN_IN_PUBLIC_UI, PUBLIC_PAYMENT_COPY } from '../domain/payments/labels'
import { formatPesoAR } from '../formatPesoAR'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260817222422_stage81_payment_pricing.sql'),
  'utf8'
)

describe('Stage 8.1 — fórmula de precio público', () => {
  it('usa 5,3119 % y redondea a $100 el ejemplo obligatorio', () => {
    expect(DEFAULT_EFFECTIVE_FEE_RATE).toBe(0.053119)
    expect(DEFAULT_ROUNDING_INCREMENT).toBe(100)
    expect(publicPriceFromBase(100000)).toBe(105700)
    const priced = pricedFromBase(100000)
    expect(priced.transfer).toBe(100000)
    expect(priced.public).toBe(105700)
    expect(priced.saving).toBe(5700)
  })

  it('el raw intermedio queda por debajo del techo a $100', () => {
    const raw = 100000 / (1 - 0.053119)
    expect(raw).toBeGreaterThan(105609)
    expect(raw).toBeLessThan(105610)
    expect(ceilToIncrement(raw, 100)).toBe(105700)
  })

  it('un importe que ya es múltiplo de $100 se conserva', () => {
    const exact = publicPriceFromBase(946881)
    expect(exact % 100).toBe(0)
    expect(publicPriceFromBase(exact, 0, 100)).toBe(exact)
  })

  it('cero queda en cero y tasas inválidas fallan', () => {
    expect(publicPriceFromBase(0)).toBe(0)
    expect(() => publicPriceFromBase(1000, 1)).toThrow('invalid_fee_rate')
    expect(() => publicPriceFromBase(1000, 0.05, 0)).toThrow('invalid_rounding_increment')
  })
})

describe('Stage 8.1 — líneas, cupón y envío', () => {
  it('producto con descuento, cantidad y combo', () => {
    const quote = quoteOrderTotals({
      lines: [
        { line_type: 'product', unit_sale_price: 100000, discount_percentage: 10, quantity: 2 },
        { line_type: 'combo', unit_sale_price: 50000, quantity: 1 },
      ],
    })
    expect(quote.lines[0].unit_base).toBe(90000)
    expect(quote.lines[0].base).toBe(180000)
    expect(quote.lines[0].unit_public).toBe(publicPriceFromBase(90000))
    expect(quote.lines[1].unit_base).toBe(50000)
    expect(quote.subtotal.base).toBe(230000)
  })

  it('aplica el mismo % de cupón a base y a público', () => {
    const quote = quoteOrderTotals({
      lines: [{ line_type: 'product', unit_sale_price: 100000, quantity: 1 }],
      coupon_percent: 10,
    })
    expect(quote.coupon.base).toBe(10000)
    expect(quote.coupon.public).toBe(Math.round(105700 * 0.1))
    expect(quote.total.transfer).toBe(90000)
    expect(quote.total.public).toBe(105700 - quote.coupon.public)
    expect(quote.total.saving).toBe(quote.total.public - quote.total.transfer)
  })

  it('cubre el envío con la misma fórmula', () => {
    const quote = quoteOrderTotals({
      lines: [{ line_type: 'product', unit_sale_price: 100000, quantity: 1 }],
      shipping_base: 8000,
    })
    expect(quote.shipping.transfer).toBe(8000)
    expect(quote.shipping.public).toBe(publicPriceFromBase(8000))
    expect(quote.total.transfer).toBe(108000)
    expect(quote.total.public).toBe(105700 + quote.shipping.public)
  })

  it('un cambio de versión no reescribe un snapshot previo', () => {
    const v1 = quoteOrderTotals({
      lines: [{ line_type: 'product', unit_sale_price: 100000, quantity: 1 }],
    })
    const v2 = quoteOrderTotals({
      lines: [{ line_type: 'product', unit_sale_price: 100000, quantity: 1 }],
      rates: { effective_fee_rate: 0.08, rounding_increment: 100 },
    })
    expect(v1.total.public).toBe(105700)
    expect(v2.total.public).not.toBe(v1.total.public)
    expect(v1.total.public).toBe(105700)
  })
})

describe('Stage 8.1 — dual price detrás de flag', () => {
  const product = {
    id: 1,
    name: 'Labial',
    brand: null,
    color: null,
    sale_price: 100000,
    stock: 3,
    category_id: 1,
    image_url: null,
    created_at: '2026-08-17T00:00:00.000Z',
    discount_percentage: 0,
  }

  it('no agrega precio público si el flag está apagado', () => {
    const next = applyProductPublicPricing(product, {
      catalog_dual_price_visible: false,
      version_id: null,
      effective_fee_rate: 0.053119,
      rounding_increment: 100,
    })
    expect(next.dual_price_visible).toBe(false)
    expect(next.public_price).toBeUndefined()
  })

  it('calcula ambos precios cuando el flag está activo', () => {
    const next = applyProductPublicPricing(product, {
      catalog_dual_price_visible: true,
      version_id: 'v1',
      effective_fee_rate: 0.053119,
      rounding_increment: 100,
    })
    expect(next.dual_price_visible).toBe(true)
    expect(next.transfer_price).toBe(100000)
    expect(next.public_price).toBe(105700)
  })
})

describe('Stage 8.1 — copy humana', () => {
  it('muestra precio de transferencia sin jerga interna', () => {
    expect(bankTransferSecondaryLine(formatPesoAR(100000))).toBe(
      '$100.000 pagando por transferencia bancaria'
    )
    expect(PUBLIC_PAYMENT_COPY.youSave).toBe('Ahorrás')
    expect(PUBLIC_PAYMENT_COPY.mercadoPago).toBe('Mercado Pago')
    for (const word of INTERNAL_WORDS_FORBIDDEN_IN_PUBLIC_UI) {
      expect(PUBLIC_PAYMENT_COPY.payingByTransfer.toLowerCase()).not.toContain(word)
      expect(PUBLIC_PAYMENT_COPY.youSave.toLowerCase()).not.toContain(word)
    }
  })
})

describe('Stage 8.1 — migración', () => {
  it('versiona precios sin mutar sale_price y nace con flags apagados', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.payment_pricing_versions')
    expect(migration).toContain('catalog_dual_price_visible boolean NOT NULL DEFAULT false')
    expect(migration).toContain('payments_enabled boolean NOT NULL DEFAULT false')
    expect(migration).not.toMatch(/UPDATE\s+public\.products\s+SET\s+sale_price/i)
    expect(migration).toContain('REVOKE ALL ON TABLE public.payment_pricing_versions FROM PUBLIC, anon, authenticated')
    expect(migration).toContain("SET search_path = ''")
    expect(migration).toContain('is_app_admin()')
    expect(migration).toContain('payment_public_price')
    expect(migration).toContain('0.053119')
  })
})
