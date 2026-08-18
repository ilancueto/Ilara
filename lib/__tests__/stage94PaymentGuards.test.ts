import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { catalogDisplayUnitPrice } from '@/lib/domain/payments/catalogDisplayPrice'
import { mapPublicPricingContext } from '@/lib/domain/payments/mappers'

const migration = readFileSync(
  join(__dirname, '../../supabase/migrations/20260818031000_stage94_orphan_payments_price.sql'),
  'utf8'
)

describe('Stage 9.4 cobros huérfanos y precio visible', () => {
  it('cancela pagos abiertos de pedidos cancelados y no acredita después', () => {
    expect(migration).toContain("o.status = 'cancelled'")
    expect(migration).toContain('ignored_cancelled_order')
    expect(migration).toContain('orders_cancel_open_payments_trg')
    expect(migration).toContain('mercado_pago_enabled IS TRUE')
  })

  it('mapea tarifas aunque el dual esté oculto', () => {
    const ctx = mapPublicPricingContext({
      catalog_dual_price_visible: false,
      mercado_pago_enabled: true,
      version_id: 'v3',
      transfer_discount_rate: '0.10',
      effective_fee_rate: '0',
      rounding_increment: '1',
    })
    expect(ctx.catalog_dual_price_visible).toBe(false)
    expect(ctx.transfer_discount_rate).toBeCloseTo(0.10)
    expect(catalogDisplayUnitPrice({
      sale_price: 100000,
      discount_percentage: 0,
      public_price: 100000,
    })).toBe(100000)
  })
})
