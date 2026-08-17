import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const buyerA = `cap-a-${crypto.randomUUID()}`
const buyerB = `cap-b-${crypto.randomUUID()}`
const hashOf = (plain: string) => createHash('sha256').update(plain).digest('hex')

const PROD_PROJECT_REFS = ['qbbnvdmadgomfmrsfxlo'] as const
const enabled = process.env.STAGE83_INTEGRATION === '1' || process.env.STAGE8_INTEGRATION === '1'
const url =
  process.env.STAGE83_SUPABASE_URL?.trim() ||
  process.env.STAGE82_SUPABASE_URL?.trim() ||
  process.env.STAGE61_SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const anonKey =
  process.env.STAGE83_ANON_KEY?.trim() ||
  process.env.STAGE82_ANON_KEY?.trim() ||
  process.env.STAGE61_ANON_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
const serviceKey =
  process.env.STAGE83_SERVICE_ROLE_KEY?.trim() ||
  process.env.STAGE82_SERVICE_ROLE_KEY?.trim() ||
  process.env.STAGE61_SERVICE_ROLE_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const adminEmail =
  process.env.STAGE83_USER_A_EMAIL?.trim() ||
  process.env.STAGE82_USER_A_EMAIL?.trim() ||
  process.env.STAGE61_USER_A_EMAIL?.trim()
const adminPassword =
  process.env.STAGE83_USER_A_PASSWORD?.trim() ||
  process.env.STAGE82_USER_A_PASSWORD?.trim() ||
  process.env.STAGE61_USER_A_PASSWORD?.trim()
const otherEmail =
  process.env.STAGE83_USER_B_EMAIL?.trim() ||
  process.env.STAGE82_USER_B_EMAIL?.trim() ||
  process.env.STAGE61_USER_B_EMAIL?.trim()
const otherPassword =
  process.env.STAGE83_USER_B_PASSWORD?.trim() ||
  process.env.STAGE82_USER_B_PASSWORD?.trim() ||
  process.env.STAGE61_USER_B_PASSWORD?.trim()

const isProd = Boolean(url && PROD_PROJECT_REFS.some((ref) => url.toLowerCase().includes(ref)))
const complete = Boolean(url && anonKey && serviceKey && adminEmail && adminPassword && otherEmail && otherPassword)
const canRun = Boolean(enabled && complete && !isProd)
const client = (key: string) => createClient(url!, key, { auth: { persistSession: false, autoRefreshToken: false } })

describe('Stage 8.3 gates', () => {
  it('no apunta a producción', () => {
    expect(isProd).toBe(false)
    if (enabled) expect(complete).toBe(true)
  })
})

describe.skipIf(!canRun)('Stage 8.3 transferencia y capability', () => {
  let service: SupabaseClient
  let admin: SupabaseClient
  let other: SupabaseClient
  let productId = 0
  let orderId = ''
  const startedStock = 8
  const salesBefore = { count: 0 }
  const incomesBefore = { count: 0 }

  beforeAll(async () => {
    service = client(serviceKey!)
    admin = client(anonKey!)
    other = client(anonKey!)
    const adminAuth = await admin.auth.signInWithPassword({ email: adminEmail!, password: adminPassword! })
    if (adminAuth.error) throw adminAuth.error
    const otherAuth = await other.auth.signInWithPassword({ email: otherEmail!, password: otherPassword! })
    if (otherAuth.error) throw otherAuth.error

    const sales = await service.from('sales').select('id', { count: 'exact', head: true })
    const incomes = await service.from('incomes').select('id', { count: 'exact', head: true })
    salesBefore.count = sales.count ?? 0
    incomesBefore.count = incomes.count ?? 0

    const product = await service.from('products').insert({
      name: `s83-${Date.now()}`,
      sale_price: 100000,
      stock: startedStock,
      min_stock: 1,
      visible_in_catalog: true,
    }).select('id').single()
    if (product.error) throw product.error
    productId = product.data.id

    const order = await service.from('orders').insert({
      order_number: `IL-S83${Date.now().toString().slice(-4)}`,
      status: 'pending',
      channel: 'catalog',
      idempotency_key: `s83-${crypto.randomUUID()}`,
      request_fingerprint: '1'.repeat(32),
      customer_name: 'Stage83',
      customer_phone: '2995558800',
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
      name_snapshot: 'Stage83',
      combo_components_snapshot: [],
      quantity: 1,
      unit_price: 100000,
      discount_percentage: 0,
      line_subtotal: 100000,
    })
    if (item.error) throw item.error
    const cap = await service.from('order_access_capabilities').insert({
      order_id: orderId,
      capability_hash: hashOf(buyerA),
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
    })
    if (cap.error) throw cap.error
  })

  afterAll(async () => {
    if (orderId) {
      const pays = (await service.from('order_payments').select('id').eq('order_id', orderId)).data ?? []
      const payIds = pays.map((row) => row.id)
      if (payIds.length) {
        await service.from('payment_receipts').delete().in('payment_id', payIds)
        await service.from('payment_events').delete().in('payment_id', payIds)
      }
      await service.from('payment_access_tokens').delete().eq('order_id', orderId)
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

  it('buyer B no inicia, ve ni opera el pago de A', async () => {
    const strangerStart = await client(anonKey!).rpc('start_catalog_order_payment', {
      p_payload: { access_capability: buyerB, method: 'bank_transfer', idempotency_key: crypto.randomUUID() },
    })
    expect(strangerStart.error?.message || '').toMatch(/invalid_access_capability/)
    const strangerView = await client(anonKey!).rpc('get_catalog_payment_public', {
      p_access_capability: buyerB,
    })
    expect(strangerView.error?.message || '').toMatch(/invalid_access_capability/)
    const strangerReceipt = await client(anonKey!).rpc('prepare_transfer_receipt', {
      p_access_capability: buyerB,
      p_extension: 'jpg',
    })
    expect(strangerReceipt.error?.message || '').toMatch(/invalid_access_capability/)
  })

  it('rechazo restaura stock una vez, reintento reserva de nuevo y aprobación no toca sales/incomes', async () => {
    const flags = await service.from('payment_pricing_versions').update({
      payments_enabled: true,
      bank_transfer_enabled: true,
    }).eq('status', 'active')
    expect(flags.error).toBeNull()

    const firstKey = crypto.randomUUID()
    const first = await admin.rpc('start_catalog_order_payment', {
      p_payload: { access_capability: buyerA, method: 'bank_transfer', idempotency_key: firstKey },
    })
    expect(first.error).toBeNull()
    const created = first.data as {
      payment_id: string
      amount_due: number
      estimated_fee: number
      price_uplift: number
    }
    expect(created.amount_due).toBe(100000)
    expect(Number(created.estimated_fee)).toBe(0)
    expect(Number(created.price_uplift)).toBeGreaterThan(0)

    const reserved = await service.from('products').select('stock').eq('id', productId).single()
    expect(reserved.data?.stock).toBe(startedStock - 1)

    const prepared = await admin.rpc('prepare_transfer_receipt', {
      p_access_capability: buyerA,
      p_extension: 'png',
    })
    expect(prepared.error).toBeNull()
    const path = String((prepared.data as { storage_path: string }).storage_path)
    expect(path.startsWith(`${created.payment_id}/`)).toBe(true)

    const uploaded = await service.storage.from('payment-receipts').upload(path, new Uint8Array([137, 80, 78, 71]), {
      contentType: 'image/png',
      upsert: false,
    })
    expect(uploaded.error).toBeNull()

    const completed = await admin.rpc('complete_transfer_receipt', {
      p_access_capability: buyerA,
      p_storage_path: path,
      p_mime_type: 'image/png',
      p_byte_size: 4,
      p_sha256: 'a'.repeat(64),
    })
    expect(completed.error).toBeNull()
    expect((completed.data as { status: string }).status).toBe('requires_review')

    const noAdmin = await other.rpc('admin_review_transfer_payment', {
      p_payment_id: created.payment_id,
      p_action: 'approve',
    })
    expect(noAdmin.error).toBeTruthy()

    const rejectedNoReason = await admin.rpc('admin_review_transfer_payment', {
      p_payment_id: created.payment_id,
      p_action: 'reject',
    })
    expect(rejectedNoReason.error?.message || '').toMatch(/reject_reason_required/)

    const rejected = await admin.rpc('admin_review_transfer_payment', {
      p_payment_id: created.payment_id,
      p_action: 'reject',
      p_reason: 'El comprobante no se lee',
    })
    expect(rejected.error).toBeNull()

    const afterReject = await service.from('products').select('stock').eq('id', productId).single()
    expect(afterReject.data?.stock).toBe(startedStock)
    const orderAfterReject = await service.from('orders').select('status, stock_reserved').eq('id', orderId).single()
    expect(orderAfterReject.data).toEqual({ status: 'pending', stock_reserved: false })

    const retry = await admin.rpc('start_catalog_order_payment', {
      p_payload: { access_capability: buyerA, method: 'bank_transfer', idempotency_key: crypto.randomUUID() },
    })
    expect(retry.error).toBeNull()
    const retried = retry.data as { payment_id: string }
    const reservedAgain = await service.from('products').select('stock').eq('id', productId).single()
    expect(reservedAgain.data?.stock).toBe(startedStock - 1)

    const prepared2 = await admin.rpc('prepare_transfer_receipt', {
      p_access_capability: buyerA,
      p_extension: 'jpg',
    })
    const path2 = String((prepared2.data as { storage_path: string }).storage_path)
    await service.storage.from('payment-receipts').upload(path2, new Uint8Array([255, 216, 255]), {
      contentType: 'image/jpeg',
      upsert: false,
    })
    const completed2 = await admin.rpc('complete_transfer_receipt', {
      p_access_capability: buyerA,
      p_storage_path: path2,
      p_mime_type: 'image/jpeg',
      p_byte_size: 3,
      p_sha256: 'b'.repeat(64),
    })
    expect(completed2.error).toBeNull()

    const approved = await admin.rpc('admin_review_transfer_payment', {
      p_payment_id: retried.payment_id,
      p_action: 'approve',
    })
    expect(approved.error).toBeNull()
    const order = await service.from('orders').select('status, stock_reserved').eq('id', orderId).single()
    expect(order.data?.status).toBe('confirmed')
    expect(order.data?.stock_reserved).toBe(true)

    const sales = await service.from('sales').select('id', { count: 'exact', head: true })
    const incomes = await service.from('incomes').select('id', { count: 'exact', head: true })
    expect(sales.count ?? 0).toBe(salesBefore.count)
    expect(incomes.count ?? 0).toBe(incomesBefore.count)
  })

  it('anon no expira y service_role deja evidencia idempotente', async () => {
    const anonExpire = await client(anonKey!).rpc('expire_catalog_payments')
    expect(anonExpire.error).toBeTruthy()
    const first = await service.rpc('expire_catalog_payments')
    expect(first.error).toBeNull()
    const second = await service.rpc('expire_catalog_payments')
    expect(second.error).toBeNull()
    const health = await service.rpc('payment_expire_health')
    expect(health.error).toBeNull()
    expect((health.data as { has_run: boolean }).has_run).toBe(true)
    const product = await service.from('products').select('stock').eq('id', productId).single()
    expect(product.data?.stock).toBe(startedStock - 1)
  })
})
