import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const buyerA = `cap-a-${crypto.randomUUID()}`
const hashOf = (plain: string) => createHash('sha256').update(plain).digest('hex')
const PROD_PROJECT_REFS = ['qbbnvdmadgomfmrsfxlo'] as const
const enabled = process.env.STAGE85_INTEGRATION === '1' || process.env.STAGE8_INTEGRATION === '1'
const url =
  process.env.STAGE85_SUPABASE_URL?.trim() ||
  process.env.STAGE61_SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const anonKey =
  process.env.STAGE85_ANON_KEY?.trim() ||
  process.env.STAGE61_ANON_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
const serviceKey =
  process.env.STAGE85_SERVICE_ROLE_KEY?.trim() ||
  process.env.STAGE61_SERVICE_ROLE_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const adminEmail =
  process.env.STAGE85_USER_A_EMAIL?.trim() || process.env.STAGE61_USER_A_EMAIL?.trim()
const adminPassword =
  process.env.STAGE85_USER_A_PASSWORD?.trim() || process.env.STAGE61_USER_A_PASSWORD?.trim()
const otherEmail =
  process.env.STAGE85_USER_B_EMAIL?.trim() || process.env.STAGE61_USER_B_EMAIL?.trim()
const otherPassword =
  process.env.STAGE85_USER_B_PASSWORD?.trim() || process.env.STAGE61_USER_B_PASSWORD?.trim()

const isProd = Boolean(url && PROD_PROJECT_REFS.some((ref) => url.toLowerCase().includes(ref)))
const complete = Boolean(url && anonKey && serviceKey && adminEmail && adminPassword && otherEmail && otherPassword)
const canRun = Boolean(enabled && complete && !isProd)
const client = (key: string) => createClient(url!, key, { auth: { persistSession: false, autoRefreshToken: false } })

describe('Stage 8.5 gates', () => {
  it('no apunta a producción', () => {
    expect(isProd).toBe(false)
    if (enabled) expect(complete).toBe(true)
  })
})

describe.skipIf(!canRun)('Stage 8.5 corte de pedidos', () => {
  let service: SupabaseClient
  let admin: SupabaseClient
  let other: SupabaseClient
  let productId = 0
  let orderId = ''

  beforeAll(async () => {
    service = client(serviceKey!)
    admin = client(anonKey!)
    other = client(anonKey!)
    if ((await admin.auth.signInWithPassword({ email: adminEmail!, password: adminPassword! })).error) {
      throw new Error('admin login')
    }
    if ((await other.auth.signInWithPassword({ email: otherEmail!, password: otherPassword! })).error) {
      throw new Error('other login')
    }
    const product = await service.from('products').insert({
      name: `s85-${Date.now()}`,
      sale_price: 100000,
      stock: 4,
      visible_in_catalog: true,
    }).select('id').single()
    if (product.error) throw product.error
    productId = product.data.id
    const order = await service.from('orders').insert({
      order_number: `IL-S85${Date.now().toString().slice(-4)}`,
      status: 'pending',
      channel: 'catalog',
      idempotency_key: `s85-${crypto.randomUUID()}`,
      request_fingerprint: '3'.repeat(32),
      customer_name: 'Stage85',
      customer_phone: '2995558600',
      subtotal: 100000,
      discount_total: 0,
      shipping_amount: 0,
      total: 100000,
      stock_reserved: false,
    }).select('id').single()
    if (order.error) throw order.error
    orderId = order.data.id
    await service.from('order_items').insert({
      order_id: orderId,
      line_type: 'product',
      product_id: productId,
      product_id_snapshot: productId,
      name_snapshot: 'Stage85',
      combo_components_snapshot: [],
      quantity: 1,
      unit_price: 100000,
      discount_percentage: 0,
      line_subtotal: 100000,
    })
    await service.from('order_access_capabilities').insert({
      order_id: orderId,
      capability_hash: hashOf(buyerA),
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
    })
  })

  afterAll(async () => {
    if (orderId) {
      const payIds = (await service.from('order_payments').select('id').eq('order_id', orderId)).data?.map((row) => row.id) ?? []
      if (payIds.length) await service.from('payment_events').delete().in('payment_id', payIds)
      await service.from('order_payments').delete().eq('order_id', orderId)
      await service.from('order_access_capabilities').delete().eq('order_id', orderId)
      await service.from('order_items').delete().eq('order_id', orderId)
      await service.from('order_status_events').delete().eq('order_id', orderId)
      await service.from('orders').delete().eq('id', orderId)
    }
    if (productId) await service.from('products').delete().eq('id', productId)
    await service.from('payment_pricing_versions').update({
      payments_enabled: false,
      mercado_pago_enabled: false,
      bank_transfer_enabled: false,
    }).eq('status', 'active')
  })

  it('anon y no-admin no leen el corte', async () => {
    const anon = await client(anonKey!).rpc('finance_stage8_payments_slice', {
      p_from: '2026-08-01',
      p_to: '2026-08-31',
    })
    expect(anon.error).toBeTruthy()
    const denied = await other.rpc('admin_payment_ops_board')
    expect(denied.error).toBeTruthy()
  })

  it('un cobro aprobado entra al corte de pedidos y no al de mostrador', async () => {
    await service.from('payment_pricing_versions').update({
      payments_enabled: true,
      mercado_pago_enabled: true,
    }).eq('status', 'active')
    const started = await admin.rpc('start_catalog_order_payment', {
      p_payload: { access_capability: buyerA, method: 'mercado_pago', idempotency_key: crypto.randomUUID() },
    })
    expect(started.error).toBeNull()
    const paymentId = (started.data as { payment_id: string }).payment_id
    const ext = (await service.from('order_payments').select('external_reference').eq('id', paymentId).single()).data
    const applied = await service.rpc('apply_mercado_pago_payment', {
      p_payload: {
        provider_payment_id: 'mp-s85',
        external_reference: ext?.external_reference,
        provider_status: 'approved',
        transaction_amount: 105700,
        currency_id: 'ARS',
        collector_id: '1',
        actual_fee: 5614,
        net_received: 100086,
        event_id: `evt-s85-${paymentId}`,
      },
    })
    expect(applied.error).toBeNull()

    const today = new Date().toISOString().slice(0, 10)
    const slice = await admin.rpc('finance_stage8_payments_slice', { p_from: today, p_to: today })
    expect(slice.error).toBeNull()
    const catalog = (slice.data as { catalog: { inflow: number }; pos: { inflow: number }; margin: { actual_fee: number } })
    expect(Number(catalog.catalog.inflow)).toBe(105700)
    expect(Number(catalog.margin.actual_fee)).toBe(5614)
    expect(Number(catalog.pos.inflow)).toBe(0)

    const posOnly = await admin.rpc('finance_stage66_snapshot', { p_from: today, p_to: today })
    expect(Number((posOnly.data as { summary: { period_inflow: number } }).summary.period_inflow)).toBe(0)

    const board = await admin.rpc('admin_payment_ops_board')
    expect(board.error).toBeNull()
    expect((board.data as { flags: { payments_enabled: boolean } }).flags.payments_enabled).toBe(true)
  })
})
