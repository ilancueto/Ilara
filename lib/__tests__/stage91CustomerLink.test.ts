import { describe, expect, it } from 'vitest'
import { mapCustomerCrmProfile } from '@/lib/domain/customers/crmMappers'
import { mapOrderListItem } from '@/lib/domain/orders/mappers'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migration = readFileSync(
  join(__dirname, '../../supabase/migrations/20260818023000_stage91_order_customer.sql'),
  'utf8'
)

describe('Stage 9.1 cliente unificado', () => {
  it('customer_id es nullable y no reescribe snapshots', () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS customer_id integer/)
    expect(migration).toMatch(/REFERENCES public\.customers\(id\) ON DELETE SET NULL/)
    expect(migration).toContain('BEFORE INSERT ON public.orders')
    expect(migration).not.toMatch(/NEW\.customer_name\s*:?=/)
    expect(migration).not.toMatch(/NEW\.customer_phone\s*:?=/)
  })

  it('no crea clientes masivos en backfill y audita ambigüedad', () => {
    expect(migration).toContain('order_customer_link_audit')
    expect(migration).toContain('ambiguous_phone')
    expect(migration).toContain('no_customer')
    expect(migration).toContain('private.match_customer_by_phone')
    const updateBlock = migration.match(/UPDATE\s+public\.orders[\s\S]*?;/)?.[0] || ''
    expect(updateBlock).not.toContain('ensure_catalog_customer')
  })

  it('no sobrescribe email existente con vacío', () => {
    expect(migration).toMatch(/WHEN email IS NULL OR btrim\(email\) = '' THEN v_email/)
  })

  it('mapea pedidos web en el CRM y conserva ventas', () => {
    const profile = mapCustomerCrmProfile({
      metrics: { sale_count: 1, net_spent: '1000' },
      catalog_orders: {
        order_count: 2,
        order_total: '3500',
        last_order_at: '2026-08-17T10:00:00Z',
        pending_count: 1,
        recent: [{ id: 'o1', order_number: 'IL-000001', status: 'pending', total: '2000', created_at: '2026-08-17' }],
      },
      activity: [
        { id: 'sale-1', type: 'sale', event_at: '2026-08-16', sale_id: 8, amount: '1000' },
        { id: 'order-o1', type: 'order', event_at: '2026-08-17', order_id: 'o1', order_number: 'IL-000001', amount: '2000', status: 'pending' },
      ],
    })
    expect(profile.metrics.sale_count).toBe(1)
    expect(profile.catalog_orders.order_count).toBe(2)
    expect(profile.catalog_orders.recent[0].order_number).toBe('IL-000001')
    expect(profile.activity[1].type).toBe('order')
    expect(profile.activity[1].order_id).toBe('o1')
  })

  it('el pedido conserva customer_id y snapshots', () => {
    const row = mapOrderListItem({
      id: 'x',
      order_number: 'IL-000009',
      status: 'pending',
      customer_id: '12',
      customer_name: 'Mara',
      customer_phone: '2991111111',
      customer_email: 'mara@example.com',
      subtotal: 10,
      discount_total: 0,
      total: 10,
      stock_reserved: false,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    })
    expect(row.customer_id).toBe(12)
    expect(row.customer_name).toBe('Mara')
    expect(row.customer_phone).toBe('2991111111')
  })
})
