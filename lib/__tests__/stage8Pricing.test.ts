import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DEFAULT_TRANSFER_DISCOUNT_RATE,
  pricedFromList,
  quoteOrderTotals,
  transferPriceFromList,
} from '../domain/payments/pricing'
import { applyProductPublicPricing } from '../domain/payments/applyPublicPricing'
import { bankTransferSecondaryLine, INTERNAL_WORDS_FORBIDDEN_IN_PUBLIC_UI, PUBLIC_PAYMENT_COPY } from '../domain/payments/labels'
import { formatPesoAR } from '../formatPesoAR'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260817222422_stage81_payment_pricing.sql'),
  'utf8'
)

describe('Stage 8.1 / 9.5 — fórmula de transferencia', () => {
  it('usa 10% sobre el precio de lista y no toca el envío', () => {
    expect(DEFAULT_TRANSFER_DISCOUNT_RATE).toBe(0.10)
    expect(transferPriceFromList(100000)).toBe(90000)
    const priced = pricedFromList(100000)
    expect(priced.public).toBe(100000)
    expect(priced.transfer).toBe(90000)
    expect(priced.saving).toBe(10000)
  })

  it('cero queda en cero y tasas inválidas fallan', () => {
    expect(transferPriceFromList(0)).toBe(0)
    expect(() => transferPriceFromList(1000, 1)).toThrow('invalid_transfer_discount')
    expect(() => transferPriceFromList(1000, -0.1)).toThrow('invalid_transfer_discount')
  })
})

describe('Stage 8.1 / 9.5 — líneas, cupón y envío', () => {
  it('producto con descuento, cantidad y combo', () => {
    const quote = quoteOrderTotals({
      lines: [
        { line_type: 'product', unit_sale_price: 100000, discount_percentage: 10, quantity: 2 },
        { line_type: 'combo', unit_sale_price: 50000, quantity: 1 },
      ],
    })
    expect(quote.lines[0].unit_public).toBe(90000)
    expect(quote.lines[0].unit_base).toBe(81000)
    expect(quote.lines[0].public).toBe(180000)
    expect(quote.lines[1].unit_public).toBe(50000)
    expect(quote.lines[1].unit_base).toBe(45000)
    expect(quote.subtotal.public).toBe(230000)
    expect(quote.total.transfer).toBe(207000)
  })

  it('aplica el cupón a la lista y el 10% sobre lo que queda', () => {
    const quote = quoteOrderTotals({
      lines: [{ line_type: 'product', unit_sale_price: 100000, quantity: 1 }],
      coupon_percent: 10,
    })
    expect(quote.coupon.public).toBe(10000)
    expect(quote.total.public).toBe(90000)
    expect(quote.total.transfer).toBe(81000)
    expect(quote.total.saving).toBe(9000)
  })

  it('no descuenta el envío', () => {
    const quote = quoteOrderTotals({
      lines: [{ line_type: 'product', unit_sale_price: 100000, quantity: 1 }],
      shipping_base: 8000,
    })
    expect(quote.shipping.public).toBe(8000)
    expect(quote.shipping.transfer).toBe(8000)
    expect(quote.total.public).toBe(108000)
    expect(quote.total.transfer).toBe(98000)
  })

  it('un cambio de versión no reescribe un snapshot previo', () => {
    const v1 = quoteOrderTotals({
      lines: [{ line_type: 'product', unit_sale_price: 100000, quantity: 1 }],
    })
    const v2 = quoteOrderTotals({
      lines: [{ line_type: 'product', unit_sale_price: 100000, quantity: 1 }],
      rates: { transfer_discount_rate: 0.15 },
    })
    expect(v1.total.public).toBe(100000)
    expect(v1.total.transfer).toBe(90000)
    expect(v2.total.public).toBe(100000)
    expect(v2.total.transfer).toBe(85000)
    expect(v2.total.transfer).not.toBe(v1.total.transfer)
  })
})

describe('Stage 8.1 / 9.5 — dual price detrás de flag', () => {
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

  it('no agrega precio de transferencia si no hay versión', () => {
    const next = applyProductPublicPricing(product, {
      catalog_dual_price_visible: false,
      version_id: null,
      transfer_discount_rate: null,
      effective_fee_rate: null,
      rounding_increment: null,
    })
    expect(next.dual_price_visible).toBe(false)
    expect(next.public_price).toBeUndefined()
    expect(next.transfer_price).toBeUndefined()
  })

  it('calcula ambos precios aunque el dual esté oculto', () => {
    const next = applyProductPublicPricing(product, {
      catalog_dual_price_visible: false,
      mercado_pago_enabled: true,
      version_id: 'v3',
      transfer_discount_rate: 0.10,
      effective_fee_rate: 0,
      rounding_increment: 1,
    })
    expect(next.dual_price_visible).toBe(false)
    expect(next.public_price).toBe(100000)
    expect(next.transfer_price).toBe(90000)
  })

  it('muestra ambos precios cuando el flag está activo', () => {
    const next = applyProductPublicPricing(product, {
      catalog_dual_price_visible: true,
      version_id: 'v1',
      transfer_discount_rate: 0.10,
      effective_fee_rate: 0,
      rounding_increment: 1,
    })
    expect(next.dual_price_visible).toBe(true)
    expect(next.transfer_price).toBe(90000)
    expect(next.public_price).toBe(100000)
  })
})

describe('Stage 8.1 — copy humana', () => {
  it('muestra precio de transferencia sin jerga interna', () => {
    expect(bankTransferSecondaryLine(formatPesoAR(90000))).toBe(
      '$90.000 pagando por transferencia bancaria'
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
