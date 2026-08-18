import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { catalogDisplayUnitPrice } from '@/lib/domain/payments/catalogDisplayPrice'
import { mapPublicPricingContext } from '@/lib/domain/payments/mappers'
import { applyProductPublicPricing } from '@/lib/domain/payments/applyPublicPricing'
import { quoteOrderTotals, transferPriceFromList } from '@/lib/domain/payments/pricing'

const migration = readFileSync(
  join(__dirname, '../../supabase/migrations/20260818033000_stage95_transfer_ten_percent.sql'),
  'utf8'
)

describe('Stage 9.5 — 10% por transferencia', () => {
  it('agrega la tasa y no reescribe sale_price ni pagos viejos', () => {
    expect(migration).toContain('transfer_discount_rate numeric(8, 4) NOT NULL DEFAULT 0.10')
    expect(migration).toContain('payment_transfer_price')
    expect(migration).toContain('El envío no se descuenta')
    expect(migration).not.toMatch(/UPDATE\s+public\.products\s+SET\s+sale_price/i)
    expect(migration).not.toMatch(/UPDATE\s+public\.order_payments/i)
    expect(migration).not.toMatch(/UPDATE\s+public\.orders\s+SET/i)
    expect(migration).toContain("SET search_path = ''")
  })

  it('mapea el 10% aunque el dual esté oculto', () => {
    const ctx = mapPublicPricingContext({
      catalog_dual_price_visible: false,
      mercado_pago_enabled: true,
      bank_transfer_enabled: true,
      version_id: 'v5',
      transfer_discount_rate: '0.10',
      effective_fee_rate: '0',
      rounding_increment: '1',
    })
    expect(ctx.transfer_discount_rate).toBeCloseTo(0.10)
    expect(catalogDisplayUnitPrice({
      sale_price: 100000,
      discount_percentage: 0,
      public_price: 100000,
    })).toBe(100000)
  })

  it('deja la lista como Mercado Pago y descuenta solo mercadería', () => {
    expect(transferPriceFromList(100000)).toBe(90000)
    const quote = quoteOrderTotals({
      lines: [{ line_type: 'product', unit_sale_price: 100000, quantity: 2 }],
      shipping_base: 8000,
    })
    expect(quote.total.public).toBe(208000)
    expect(quote.total.transfer).toBe(188000)
  })

  it('adjunta ambos precios para el catálogo', () => {
    const next = applyProductPublicPricing({
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
    }, {
      catalog_dual_price_visible: true,
      version_id: 'v5',
      transfer_discount_rate: 0.10,
      effective_fee_rate: 0,
      rounding_increment: 1,
    })
    expect(next.public_price).toBe(100000)
    expect(next.transfer_price).toBe(90000)
    expect(next.dual_price_visible).toBe(true)
  })
})
