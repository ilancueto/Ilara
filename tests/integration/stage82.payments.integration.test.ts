import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const PROD_PROJECT_REFS = ['qbbnvdmadgomfmrsfxlo'] as const
const enabled = process.env.STAGE82_INTEGRATION === '1' || process.env.STAGE8_INTEGRATION === '1'
const url =
  process.env.STAGE82_SUPABASE_URL?.trim() ||
  process.env.STAGE81_SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const anonKey =
  process.env.STAGE82_ANON_KEY?.trim() ||
  process.env.STAGE81_ANON_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
const serviceKey =
  process.env.STAGE82_SERVICE_ROLE_KEY?.trim() ||
  process.env.STAGE81_SERVICE_ROLE_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const adminEmail =
  process.env.STAGE82_USER_A_EMAIL?.trim() ||
  process.env.STAGE81_USER_A_EMAIL?.trim()
const adminPassword =
  process.env.STAGE82_USER_A_PASSWORD?.trim() ||
  process.env.STAGE81_USER_A_PASSWORD?.trim()
const otherEmail =
  process.env.STAGE82_USER_B_EMAIL?.trim() ||
  process.env.STAGE81_USER_B_EMAIL?.trim()
const otherPassword =
  process.env.STAGE82_USER_B_PASSWORD?.trim() ||
  process.env.STAGE81_USER_B_PASSWORD?.trim()

const isProd = Boolean(url && PROD_PROJECT_REFS.some((ref) => url.toLowerCase().includes(ref)))
const complete = Boolean(url && anonKey && serviceKey && adminEmail && adminPassword && otherEmail && otherPassword)
const canRun = Boolean(enabled && complete && !isProd)
const client = (key: string) => createClient(url!, key, { auth: { persistSession: false, autoRefreshToken: false } })

describe('Stage 8.2 gates', () => {
  it('no apunta a producción', () => {
    expect(isProd).toBe(false)
    if (enabled) expect(complete).toBe(true)
  })
})

describe.skipIf(!canRun)('Stage 8.2 core de pagos', () => {
  let service: SupabaseClient
  let admin: SupabaseClient
  let other: SupabaseClient
  let productId = 0
  let orderId = ''
  const startedStock = 10

  beforeAll(async () => {
    service = client(serviceKey!)
    admin = client(anonKey!)
    other = client(anonKey!)
    const adminAuth = await admin.auth.signInWithPassword({ email: adminEmail!, password: adminPassword! })
    if (adminAuth.error) throw adminAuth.error
    const otherAuth = await other.auth.signInWithPassword({ email: otherEmail!, password: otherPassword! })
    if (otherAuth.error) throw otherAuth.error

    const product = await service.from('products').insert({
      name: `s82-${Date.now()}`,
      sale_price: 100000,
      stock: startedStock,
      min_stock: 1,
      visible_in_catalog: true,
    }).select('id').single()
    if (product.error) throw product.error
    productId = product.data.id

    const order = await service.from('orders').insert({
      order_number: `IL-S82${Date.now().toString().slice(-4)}`,
      status: 'pending',
      channel: 'catalog',
      idempotency_key: `s82-${crypto.randomUUID()}`,
      request_fingerprint: '0'.repeat(32),
      customer_name: 'Stage82',
      customer_phone: '2995558899',
      subtotal: 100000,
      discount_total: 0,
      shipping_amount: 0,
      total: 100000,
      stock_reserved: false,
    }).select('id').single()
    if (order.error) throw order.error
    orderId = order.data.id
    const item = await service.from('order_items').insert({
      order_id: orderId,
      line_type: 'product',
      product_id: productId,
      product_id_snapshot: productId,
      name_snapshot: 'Stage82',
      combo_components_snapshot: [],
      quantity: 1,
      unit_price: 100000,
      discount_percentage: 0,
      line_subtotal: 100000,
    })
    if (item.error) throw item.error
  })

  afterAll(async () => {
    if (orderId) {
      await service.from('payment_access_tokens').delete().eq('order_id', orderId)
      await service.from('payment_events').delete().in('payment_id', (
        await service.from('order_payments').select('id').eq('order_id', orderId)
      ).data?.map((row) => row.id) ?? [])
      await service.from('order_payments').delete().eq('order_id', orderId)
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

  it('anon no lee pagos y start falla con capa apagada', async () => {
    const anon = client(anonKey!)
    const table = await anon.from('order_payments').select('id')
    expect(table.error).toBeTruthy()
    const started = await anon.rpc('start_catalog_order_payment', {
      p_payload: { order_id: orderId, method: 'bank_transfer', idempotency_key: crypto.randomUUID() },
    })
    expect(started.error?.message || '').toMatch(/payments_disabled/)
  })

  it('reserva una sola vez, rechaza precio cliente y expira restaurando stock', async () => {
    const enabledFlags = await service.from('payment_pricing_versions').update({
      payments_enabled: true,
      bank_transfer_enabled: true,
    }).eq('status', 'active')
    expect(enabledFlags.error).toBeNull()

    const rejected = await admin.rpc('start_catalog_order_payment', {
      p_payload: {
        order_id: orderId,
        method: 'bank_transfer',
        idempotency_key: crypto.randomUUID(),
        amount_due: 1,
      },
    })
    expect(rejected.error?.message || '').toMatch(/client_price_not_allowed/)

    const key = crypto.randomUUID()
    const first = await admin.rpc('start_catalog_order_payment', {
      p_payload: { order_id: orderId, method: 'bank_transfer', idempotency_key: key },
    })
    expect(first.error).toBeNull()
    const created = first.data as { payment_id: string; amount_due: number; access_token: string; stock_reserved: boolean }
    expect(created.amount_due).toBe(100000)
    expect(created.access_token).toMatch(/^[a-f0-9]{64}$/)
    expect(created.stock_reserved).toBe(true)

    const replay = await admin.rpc('start_catalog_order_payment', {
      p_payload: { order_id: orderId, method: 'bank_transfer', idempotency_key: key },
    })
    expect(replay.error).toBeNull()
    expect((replay.data as { idempotent_replay: boolean }).idempotent_replay).toBe(true)
    expect((replay.data as { access_token?: string }).access_token).toBeUndefined()

    const product = await service.from('products').select('stock').eq('id', productId).single()
    expect(product.data?.stock).toBe(startedStock - 1)

    await service.from('order_payments').update({
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    }).eq('id', created.payment_id)

    const expired = await service.rpc('expire_catalog_payments')
    expect(expired.error).toBeNull()
    expect(Number((expired.data as { expired: number }).expired)).toBeGreaterThanOrEqual(1)

    const after = await service.from('products').select('stock').eq('id', productId).single()
    expect(after.data?.stock).toBe(startedStock)
    const order = await service.from('orders').select('status, stock_reserved').eq('id', orderId).single()
    expect(order.data).toEqual({ status: 'cancelled', stock_reserved: false })
  })

  it('no-admin no confirma y anon no expira', async () => {
    const confirm = await other.rpc('confirm_catalog_order_after_payment', { p_order_id: orderId })
    expect(confirm.error).toBeTruthy()
    const expire = await client(anonKey!).rpc('expire_catalog_payments')
    expect(expire.error).toBeTruthy()
  })
})
