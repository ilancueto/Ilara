import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const buyerA = `cap-a-${crypto.randomUUID()}`
const buyerB = `cap-b-${crypto.randomUUID()}`
const hashOf = (plain: string) => createHash('sha256').update(plain).digest('hex')

const PROD_PROJECT_REFS = ['qbbnvdmadgomfmrsfxlo'] as const
const enabled = process.env.STAGE84_INTEGRATION === '1' || process.env.STAGE8_INTEGRATION === '1'
const url =
  process.env.STAGE84_SUPABASE_URL?.trim() ||
  process.env.STAGE61_SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const anonKey =
  process.env.STAGE84_ANON_KEY?.trim() ||
  process.env.STAGE61_ANON_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
const serviceKey =
  process.env.STAGE84_SERVICE_ROLE_KEY?.trim() ||
  process.env.STAGE61_SERVICE_ROLE_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const adminEmail =
  process.env.STAGE84_USER_A_EMAIL?.trim() || process.env.STAGE61_USER_A_EMAIL?.trim()
const adminPassword =
  process.env.STAGE84_USER_A_PASSWORD?.trim() || process.env.STAGE61_USER_A_PASSWORD?.trim()
const otherEmail =
  process.env.STAGE84_USER_B_EMAIL?.trim() || process.env.STAGE61_USER_B_EMAIL?.trim()
const otherPassword =
  process.env.STAGE84_USER_B_PASSWORD?.trim() || process.env.STAGE61_USER_B_PASSWORD?.trim()

const isProd = Boolean(url && PROD_PROJECT_REFS.some((ref) => url.toLowerCase().includes(ref)))
const complete = Boolean(url && anonKey && serviceKey && adminEmail && adminPassword && otherEmail && otherPassword)
const canRun = Boolean(enabled && complete && !isProd)
const client = (key: string) => createClient(url!, key, { auth: { persistSession: false, autoRefreshToken: false } })

describe('Stage 8.4 gates', () => {
  it('no apunta a producción', () => {
    expect(isProd).toBe(false)
    if (enabled) expect(complete).toBe(true)
  })
})

describe.skipIf(!canRun)('Stage 8.4 Mercado Pago canónico', () => {
  let service: SupabaseClient
  let admin: SupabaseClient
  let other: SupabaseClient
  let productId = 0
  let orderId = ''
  const startedStock = 6
  const salesBefore = { count: 0 }

  beforeAll(async () => {
    service = client(serviceKey!)
    admin = client(anonKey!)
    other = client(anonKey!)
    const adminAuth = await admin.auth.signInWithPassword({ email: adminEmail!, password: adminPassword! })
    if (adminAuth.error) throw adminAuth.error
    const otherAuth = await other.auth.signInWithPassword({ email: otherEmail!, password: otherPassword! })
    if (otherAuth.error) throw otherAuth.error
    salesBefore.count = (await service.from('sales').select('id', { count: 'exact', head: true })).count ?? 0

    const product = await service.from('products').insert({
      name: `s84-${Date.now()}`,
      sale_price: 100000,
      stock: startedStock,
      min_stock: 1,
      visible_in_catalog: true,
    }).select('id').single()
    if (product.error) throw product.error
    productId = product.data.id

    const order = await service.from('orders').insert({
      order_number: `IL-S84${Date.now().toString().slice(-4)}`,
      status: 'pending',
      channel: 'catalog',
      idempotency_key: `s84-${crypto.randomUUID()}`,
      request_fingerprint: '2'.repeat(32),
      customer_name: 'Stage84',
      customer_phone: '2995558700',
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
      name_snapshot: 'Stage84',
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

  it('anon no aplica estados y start falla con capa apagada', async () => {
    const anon = client(anonKey!)
    const apply = await anon.rpc('apply_mercado_pago_payment', {
      p_payload: { external_reference: 'x', provider_payment_id: '1', event_id: 'e' },
    })
    expect(apply.error).toBeTruthy()
    const started = await anon.rpc('start_catalog_order_payment', {
      p_payload: { access_capability: buyerA, method: 'mercado_pago', idempotency_key: crypto.randomUUID() },
    })
    expect(started.error?.message || '').toMatch(/payments_disabled|method_disabled/)
  })

  it('buyer B no ve el pago de A', async () => {
    const peek = await admin.rpc('get_catalog_payment_public', { p_access_capability: buyerB })
    expect(peek.error?.message || '').toMatch(/invalid_access_capability/)
  })

  it('GET canónico aprueba, ignora tarde y no inserta sales', async () => {
    await service.from('payment_pricing_versions').update({
      payments_enabled: true,
      mercado_pago_enabled: true,
    }).eq('status', 'active')

    const started = await admin.rpc('start_catalog_order_payment', {
      p_payload: { access_capability: buyerA, method: 'mercado_pago', idempotency_key: crypto.randomUUID() },
    })
    expect(started.error).toBeNull()
    const created = started.data as { payment_id: string; amount_due: number; estimated_fee: number; external_reference?: string }
    expect(created.amount_due).toBe(105700)
    expect(Number(created.estimated_fee)).toBeGreaterThan(0)

    const pay = await service.from('order_payments').select('external_reference, amount_due').eq('id', created.payment_id).single()
    const ext = String(pay.data?.external_reference)

    const mismatch = await service.rpc('apply_mercado_pago_payment', {
      p_payload: {
        provider_payment_id: 'mp-1',
        external_reference: ext,
        provider_status: 'approved',
        transaction_amount: 1,
        currency_id: 'ARS',
        collector_id: '99',
        event_id: `evt-mismatch-${created.payment_id}`,
      },
    })
    expect(mismatch.error?.message || '').toMatch(/payment_mismatch/)

    const approved = await service.rpc('apply_mercado_pago_payment', {
      p_payload: {
        provider_payment_id: 'mp-ok',
        external_reference: ext,
        provider_status: 'approved',
        transaction_amount: 105700,
        currency_id: 'ARS',
        collector_id: '99',
        actual_fee: 5613.86,
        net_received: 100086.14,
        event_id: `evt-ok-${created.payment_id}`,
      },
    })
    expect(approved.error).toBeNull()
    expect((approved.data as { status: string }).status).toBe('approved')

    const replay = await service.rpc('apply_mercado_pago_payment', {
      p_payload: {
        provider_payment_id: 'mp-ok',
        external_reference: ext,
        provider_status: 'approved',
        transaction_amount: 105700,
        currency_id: 'ARS',
        collector_id: '99',
        event_id: `evt-ok-${created.payment_id}`,
      },
    })
    expect((replay.data as { result: string }).result).toBe('duplicate')

    const stale = await service.rpc('apply_mercado_pago_payment', {
      p_payload: {
        provider_payment_id: 'mp-ok',
        external_reference: ext,
        provider_status: 'rejected',
        transaction_amount: 105700,
        currency_id: 'ARS',
        collector_id: '99',
        event_id: `evt-stale-${created.payment_id}`,
      },
    })
    expect((stale.data as { result: string }).result).toBe('ignored_stale')

    const order = await service.from('orders').select('status, stock_reserved').eq('id', orderId).single()
    expect(order.data).toEqual({ status: 'confirmed', stock_reserved: true })
    const sales = await service.from('sales').select('id', { count: 'exact', head: true })
    expect(sales.count ?? 0).toBe(salesBefore.count)

    const deniedRefund = await other.rpc('admin_refund_catalog_payment', {
      p_payment_id: created.payment_id,
      p_amount: 105700,
      p_reason: 'Prueba de reembolso',
    })
    expect(deniedRefund.error).toBeTruthy()

    const refunded = await admin.rpc('admin_refund_catalog_payment', {
      p_payment_id: created.payment_id,
      p_amount: 105700,
      p_reason: 'Prueba de reembolso',
    })
    expect(refunded.error).toBeNull()
    expect((refunded.data as { status: string }).status).toBe('refunded')
    const afterRefund = await service.from('orders').select('status, stock_reserved').eq('id', orderId).single()
    expect(afterRefund.data).toEqual({ status: 'confirmed', stock_reserved: true })
    const salesAfter = await service.from('sales').select('id', { count: 'exact', head: true })
    expect(salesAfter.count ?? 0).toBe(salesBefore.count)
  })
})
