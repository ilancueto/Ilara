/**
 * Integración Stage 6.1 — pedidos de catálogo.
 *
 * Habilitación: STAGE61_INTEGRATION=1 (o STAGE1_INTEGRATION=1)
 * Fail-closed si el flag está y faltan credenciales. Bloquea prod.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const PROD_PROJECT_REFS = ['qbbnvdmadgomfmrsfxlo'] as const

const enabled =
  process.env.STAGE61_INTEGRATION === '1' || process.env.STAGE1_INTEGRATION === '1'
const url =
  process.env.STAGE61_SUPABASE_URL?.trim() ||
  process.env.STAGE1_SUPABASE_URL?.trim() ||
  process.env.STAGE0_SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const anonKey =
  process.env.STAGE61_ANON_KEY?.trim() ||
  process.env.STAGE1_ANON_KEY?.trim() ||
  process.env.STAGE0_ANON_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
const serviceKey =
  process.env.STAGE61_SERVICE_ROLE_KEY?.trim() ||
  process.env.STAGE1_SERVICE_ROLE_KEY?.trim() ||
  process.env.STAGE0_SERVICE_ROLE_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const adminEmail =
  process.env.STAGE61_USER_A_EMAIL?.trim() ||
  process.env.STAGE1_USER_A_EMAIL?.trim() ||
  process.env.STAGE0_USER_A_EMAIL?.trim()
const adminPassword =
  process.env.STAGE61_USER_A_PASSWORD?.trim() ||
  process.env.STAGE1_USER_A_PASSWORD?.trim() ||
  process.env.STAGE0_USER_A_PASSWORD?.trim()
const otherEmail =
  process.env.STAGE61_USER_B_EMAIL?.trim() ||
  process.env.STAGE1_USER_B_EMAIL?.trim() ||
  process.env.STAGE0_USER_B_EMAIL?.trim()
const otherPassword =
  process.env.STAGE61_USER_B_PASSWORD?.trim() ||
  process.env.STAGE1_USER_B_PASSWORD?.trim() ||
  process.env.STAGE0_USER_B_PASSWORD?.trim()

function isProductionTarget(targetUrl: string | undefined): boolean {
  if (!targetUrl) return false
  return PROD_PROJECT_REFS.some((ref) => targetUrl.toLowerCase().includes(ref))
}

const isProd = isProductionTarget(url)

function requiredConfigComplete(): boolean {
  return Boolean(url && anonKey && serviceKey && adminEmail && adminPassword && otherEmail && otherPassword)
}

const canRun = Boolean(enabled && requiredConfigComplete() && !isProd)

function anon(): SupabaseClient {
  return createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function service(): SupabaseClient {
  return createClient(url!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const c = createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`signIn failed: ${error.message}`)
  return c
}

function expectDenied(error: { message?: string; code?: string } | null, data: unknown) {
  if (data && Array.isArray(data) && data.length > 0) {
    throw new Error('expected deny but got rows')
  }
  if (!error) {
    // 0 rows without error is still a soft leak surface for list; treat as fail for orders
    throw new Error('expected privilege/RLS error')
  }
}

describe('Stage 6.1 gates', () => {
  it('no apunta a producción', () => {
    expect(isProd).toBe(false)
  })

  it('con flag exige credenciales', () => {
    if (enabled && !isProd) {
      expect(requiredConfigComplete()).toBe(true)
    } else {
      expect(true).toBe(true)
    }
  })
})

describe.skipIf(!canRun)('Stage 6.1 pedidos integración', () => {
  let productId: number
  let comboId: number
  let comboProductId: number
  let couponCode: string
  let adminId: string
  let otherId: string
  let adminRole: string | null
  let otherRole: string | null
  const createdOrderIds: string[] = []
  const createdQuoteIds: string[] = []

  async function createTestShippingQuote(amount = 500): Promise<string> {
    const { data, error } = await service()
      .from('shipping_quotes')
      .insert({
        quote_group_id: crypto.randomUUID(),
        provider: 'envia',
        destination_postal_code: '1000',
        destination_city: 'Buenos Aires',
        destination_state: 'Comuna 1',
        destination_province_id: '02',
        destination_locality_id: '02000010',
        destination_street: 'AV CORRIENTES',
        destination_number: '1000',
        destination_formatted_address: 'AV CORRIENTES 1000, Buenos Aires, CABA',
        destination_lat: -34.6037,
        destination_lon: -58.3816,
        carrier: 'test_carrier',
        carrier_description: 'Carrier Test',
        service: 'test_service',
        service_description: 'Servicio Test',
        delivery_estimate: '2-4 días',
        amount,
        currency: 'ARS',
        request_ip_hash: 'a'.repeat(64),
        expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      })
      .select('id')
      .single()
    if (error || !data?.id) throw error || new Error('shipping quote fixture missing')
    createdQuoteIds.push(data.id)
    return data.id
  }

  beforeAll(async () => {
    const admin = service()
    const a = await signIn(adminEmail!, adminPassword!)
    const b = await signIn(otherEmail!, otherPassword!)
    const au = (await a.auth.getUser()).data.user
    const bu = (await b.auth.getUser()).data.user
    if (!au?.id || !bu?.id) throw new Error('users missing')
    adminId = au.id
    otherId = bu.id

    const { data: ar } = await admin.from('user_roles').select('role').eq('user_id', adminId).maybeSingle()
    const { data: br } = await admin.from('user_roles').select('role').eq('user_id', otherId).maybeSingle()
    adminRole = ar?.role ?? null
    otherRole = br?.role ?? null

    await admin.from('user_roles').upsert({ user_id: adminId, role: 'admin', updated_by: adminId })
    await admin.from('user_roles').upsert({ user_id: otherId, role: 'none', updated_by: adminId })

    const { data: cat, error: catErr } = await admin
      .from('categories')
      .insert({ name: `s61-cat-${Date.now()}` })
      .select('id')
      .single()
    if (catErr) throw catErr

    const { data: p1, error: p1e } = await admin
      .from('products')
      .insert({
        name: `s61-prod-${Date.now()}`,
        category_id: cat.id,
        sale_price: 1000,
        stock: 20,
        discount_percentage: 10,
        visible_in_catalog: true,
      })
      .select('id')
      .single()
    if (p1e) throw p1e
    productId = p1.id

    const { data: p2, error: p2e } = await admin
      .from('products')
      .insert({
        name: `s61-comp-${Date.now()}`,
        category_id: cat.id,
        sale_price: 500,
        stock: 30,
        discount_percentage: 0,
        visible_in_catalog: true,
      })
      .select('id')
      .single()
    if (p2e) throw p2e
    comboProductId = p2.id

    const { data: combo, error: ce } = await admin
      .from('combos')
      .insert({
        name: `s61-combo-${Date.now()}`,
        sale_price: 800,
        is_active: true,
      })
      .select('id')
      .single()
    if (ce) throw ce
    comboId = combo.id
    await admin.from('combo_items').insert({ combo_id: comboId, product_id: comboProductId, quantity: 2 })

    couponCode = `S61${Date.now().toString().slice(-6)}`
    await admin.from('coupons').insert({
      code: couponCode,
      discount_percentage: 10,
      is_active: true,
    })
  }, 60_000)

  afterAll(async () => {
    const admin = service()
    if (createdOrderIds.length) {
      await admin
        .from('shipping_quotes')
        .update({ order_id: null, consumed_at: null })
        .in('order_id', createdOrderIds)
      await admin.from('order_status_events').delete().in('order_id', createdOrderIds)
      await admin.from('order_items').delete().in('order_id', createdOrderIds)
      await admin.from('orders').delete().in('id', createdOrderIds)
    }
    if (createdQuoteIds.length) {
      await admin.from('shipping_quotes').delete().in('id', createdQuoteIds)
    }
    if (comboId) {
      await admin.from('combo_items').delete().eq('combo_id', comboId)
      await admin.from('combos').delete().eq('id', comboId)
    }
    if (productId) await admin.from('products').delete().eq('id', productId)
    if (comboProductId) await admin.from('products').delete().eq('id', comboProductId)
    if (couponCode) await admin.from('coupons').delete().eq('code', couponCode)

    if (adminRole === null) await admin.from('user_roles').delete().eq('user_id', adminId)
    else await admin.from('user_roles').upsert({ user_id: adminId, role: adminRole, updated_by: adminId })
    if (otherRole === null) await admin.from('user_roles').delete().eq('user_id', otherId)
    else await admin.from('user_roles').upsert({ user_id: otherId, role: otherRole, updated_by: adminId })
  }, 60_000)

  it('anon no lista ni lee pedidos', async () => {
    const a = anon()
    const list = await a.from('orders').select('id').limit(1)
    expectDenied(list.error, list.data)

    const items = await a.from('order_items').select('id').limit(1)
    expectDenied(items.error, items.data)

    const events = await a.from('order_status_events').select('id').limit(1)
    expectDenied(events.error, events.data)

    const quotes = await a.from('shipping_quotes').select('id').limit(1)
    expectDenied(quotes.error, quotes.data)
  })

  it('crea pedido con precios autoritativos e ignora manipulación de total', async () => {
    const a = anon()
    const idem = crypto.randomUUID()
    const shippingQuoteId = await createTestShippingQuote()
    const { data, error } = await a.rpc('create_catalog_order', {
      p_payload: {
        idempotency_key: idem,
        shipping_quote_id: shippingQuoteId,
        customer_name: 'Cliente Test',
        customer_phone: '2995550001',
        lines: [{ line_type: 'product', product_id: productId, quantity: 2 }],
        coupon_code: couponCode,
        // manipulación
        total: 1,
        unit_price: 1,
      },
    })
    expect(error?.message || '').toMatch(/client_price_not_allowed/)
    expect(data).toBeNull()

    const { data: okData, error: okErr } = await a.rpc('create_catalog_order', {
      p_payload: {
        idempotency_key: idem,
        shipping_quote_id: shippingQuoteId,
        customer_name: 'Cliente Test',
        customer_phone: '2995550001',
        lines: [{ line_type: 'product', product_id: productId, quantity: 2 }],
        coupon_code: couponCode,
      },
    })
    expect(okErr).toBeNull()
    // unit con 10% = 900; x2 = 1800; cupón 10% = 180; envío = 500
    expect(Number(okData.subtotal)).toBe(1800)
    expect(Number(okData.discount_total)).toBe(180)
    expect(Number(okData.shipping_amount)).toBe(500)
    expect(Number(okData.total)).toBe(2120)
    expect(okData.order_number).toMatch(/^IL-\d{6}$/)
    createdOrderIds.push(okData.order_id)

    // pending no descuenta
    const { data: p } = await service().from('products').select('stock').eq('id', productId).single()
    expect(p?.stock).toBe(20)
  })

  it('idempotencia concurrente: misma clave devuelve el mismo pedido y rechaza otro payload', async () => {
    const a = anon()
    const idem = crypto.randomUUID()
    const shippingQuoteId = await createTestShippingQuote()
    const payload = {
      idempotency_key: idem,
      shipping_quote_id: shippingQuoteId,
      customer_name: 'Idem',
      customer_phone: '2995550002',
      lines: [{ line_type: 'product', product_id: productId, quantity: 1 }],
    }
    const [r1, r2] = await Promise.all([
      a.rpc('create_catalog_order', { p_payload: payload }),
      a.rpc('create_catalog_order', { p_payload: payload }),
    ])
    expect(r1.error).toBeNull()
    expect(r2.error).toBeNull()
    createdOrderIds.push(r1.data.order_id)
    expect(r2.data.order_id).toBe(r1.data.order_id)
    expect([r1.data.idempotent_replay, r2.data.idempotent_replay].sort()).toEqual([false, true])

    const mismatch = await a.rpc('create_catalog_order', {
      p_payload: { ...payload, customer_name: 'Otro cliente' },
    })
    expect(mismatch.error?.message || '').toMatch(/idempotency_conflict/)
  })

  it('rate limit conserva el máximo de 8 pedidos aun con concurrencia', async () => {
    const a = anon()
    const phone = `298${String(Date.now()).slice(-7)}`
    const results = await Promise.all(
      Array.from({ length: 9 }, async (_, index) => {
        const shippingQuoteId = await createTestShippingQuote()
        return a.rpc('create_catalog_order', {
          p_payload: {
            idempotency_key: crypto.randomUUID(),
            shipping_quote_id: shippingQuoteId,
            customer_name: `Rate ${index}`,
            customer_phone: phone,
            lines: [{ line_type: 'product', product_id: productId, quantity: 1 }],
          },
        })
      })
    )
    const successful = results.filter((result) => !result.error)
    const limited = results.filter((result) => result.error)
    expect(successful).toHaveLength(8)
    expect(limited).toHaveLength(1)
    expect(limited[0]?.error?.message || '').toMatch(/rate_limited/)
    createdOrderIds.push(...successful.map((result) => result.data.order_id as string))
  })

  it('no confirma si un producto fue eliminado mientras el pedido estaba pending', async () => {
    const admin = service()
    const { data: source, error: sourceErr } = await admin
      .from('products')
      .select('category_id')
      .eq('id', productId)
      .single()
    if (sourceErr) throw sourceErr

    const { data: ephemeral, error: ephemeralErr } = await admin
      .from('products')
      .insert({
        name: `s61-ephemeral-${Date.now()}`,
        category_id: source.category_id,
        sale_price: 700,
        stock: 4,
        discount_percentage: 0,
        visible_in_catalog: true,
      })
      .select('id')
      .single()
    if (ephemeralErr) throw ephemeralErr

    const create = await anon().rpc('create_catalog_order', {
      p_payload: {
        idempotency_key: crypto.randomUUID(),
        shipping_quote_id: await createTestShippingQuote(),
        customer_name: 'Producto eliminado',
        customer_phone: '2995550098',
        lines: [{ line_type: 'product', product_id: ephemeral.id, quantity: 1 }],
      },
    })
    expect(create.error).toBeNull()
    createdOrderIds.push(create.data.order_id)

    const removed = await admin.from('products').delete().eq('id', ephemeral.id)
    expect(removed.error).toBeNull()

    const adminClient = await signIn(adminEmail!, adminPassword!)
    const confirmMissing = await adminClient.rpc('transition_catalog_order', {
      p_order_id: create.data.order_id,
      p_to_status: 'confirmed',
      p_reason: null,
    })
    expect(confirmMissing.error?.message || '').toMatch(/product_not_available/)

    const { data: persisted, error: persistedErr } = await adminClient
      .from('orders')
      .select('status, stock_reserved')
      .eq('id', create.data.order_id)
      .single()
    expect(persistedErr).toBeNull()
    expect(persisted).toMatchObject({ status: 'pending', stock_reserved: false })
  })

  it('rechaza cupón inválido y producto invisible', async () => {
    const a = anon()
    const badCoupon = await a.rpc('create_catalog_order', {
      p_payload: {
        idempotency_key: crypto.randomUUID(),
        shipping_quote_id: await createTestShippingQuote(),
        customer_name: 'X',
        customer_phone: '2995550003',
        coupon_code: 'NOEXISTE999',
        lines: [{ line_type: 'product', product_id: productId, quantity: 1 }],
      },
    })
    expect(badCoupon.error?.message || '').toMatch(/invalid_coupon/)

    await service().from('products').update({ visible_in_catalog: false }).eq('id', productId)
    const hidden = await a.rpc('create_catalog_order', {
      p_payload: {
        idempotency_key: crypto.randomUUID(),
        shipping_quote_id: await createTestShippingQuote(),
        customer_name: 'X',
        customer_phone: '2995550004',
        lines: [{ line_type: 'product', product_id: productId, quantity: 1 }],
      },
    })
    expect(hidden.error?.message || '').toMatch(/product_not_available/)
    await service().from('products').update({ visible_in_catalog: true }).eq('id', productId)
  })

  it('admin confirma (stock), cancel restaura; no-admin no opera', async () => {
    const a = anon()
    const create = await a.rpc('create_catalog_order', {
      p_payload: {
        idempotency_key: crypto.randomUUID(),
        shipping_quote_id: await createTestShippingQuote(),
        customer_name: 'Stock',
        customer_phone: '2995550005',
        lines: [
          { line_type: 'product', product_id: productId, quantity: 1 },
          { line_type: 'combo', combo_id: comboId, quantity: 1 },
        ],
      },
    })
    expect(create.error).toBeNull()
    const orderId = create.data.order_id as string
    createdOrderIds.push(orderId)

    const noneUser = await signIn(otherEmail!, otherPassword!)
    const denied = await noneUser.rpc('transition_catalog_order', {
      p_order_id: orderId,
      p_to_status: 'confirmed',
      p_reason: null,
    })
    expect(denied.error?.message || '').toMatch(/not_authorized|not_authenticated|permission/i)

    const adminClient = await signIn(adminEmail!, adminPassword!)
    const { data: before } = await service()
      .from('products')
      .select('id, stock')
      .in('id', [productId, comboProductId])
    const stockBefore = Object.fromEntries((before || []).map((r) => [r.id, r.stock]))

    const conf = await adminClient.rpc('transition_catalog_order', {
      p_order_id: orderId,
      p_to_status: 'confirmed',
      p_reason: null,
    })
    expect(conf.error).toBeNull()
    expect(conf.data.status).toBe('confirmed')

    const conf2 = await adminClient.rpc('transition_catalog_order', {
      p_order_id: orderId,
      p_to_status: 'confirmed',
      p_reason: null,
    })
    expect(conf2.error).toBeNull()
    expect(conf2.data.idempotent_replay).toBe(true)

    const blockedDelete = await service().from('products').delete().eq('id', productId)
    expect(blockedDelete.error?.message || '').toMatch(/product_reserved_by_order/)

    const { data: mid } = await service()
      .from('products')
      .select('id, stock')
      .in('id', [productId, comboProductId])
    const stockMid = Object.fromEntries((mid || []).map((r) => [r.id, r.stock]))
    // product -1; combo components 2
    expect(stockMid[productId]).toBe(stockBefore[productId] - 1)
    expect(stockMid[comboProductId]).toBe(stockBefore[comboProductId] - 2)

    const bad = await adminClient.rpc('transition_catalog_order', {
      p_order_id: orderId,
      p_to_status: 'completed',
      p_reason: null,
    })
    expect(bad.error?.message || '').toMatch(/invalid_transition/)

    const prep = await adminClient.rpc('transition_catalog_order', {
      p_order_id: orderId,
      p_to_status: 'preparing',
    })
    expect(prep.error).toBeNull()

    const cancel = await adminClient.rpc('transition_catalog_order', {
      p_order_id: orderId,
      p_to_status: 'cancelled',
      p_reason: 'test cancel',
    })
    expect(cancel.error).toBeNull()

    const cancel2 = await adminClient.rpc('transition_catalog_order', {
      p_order_id: orderId,
      p_to_status: 'cancelled',
      p_reason: 'test cancel again',
    })
    expect(cancel2.error).toBeNull()
    expect(cancel2.data.idempotent_replay).toBe(true)

    const { data: after } = await service()
      .from('products')
      .select('id, stock')
      .in('id', [productId, comboProductId])
    const stockAfter = Object.fromEntries((after || []).map((r) => [r.id, r.stock]))
    expect(stockAfter[productId]).toBe(stockBefore[productId])
    expect(stockAfter[comboProductId]).toBe(stockBefore[comboProductId])
  })

  it('admin puede listar; none no', async () => {
    const adminClient = await signIn(adminEmail!, adminPassword!)
    const ok = await adminClient.from('orders').select('id, order_number').limit(5)
    expect(ok.error).toBeNull()

    const noneUser = await signIn(otherEmail!, otherPassword!)
    const denied = await noneUser.from('orders').select('id').limit(1)
    // RLS: 0 rows or error
    if (denied.error) {
      expect(denied.error).toBeTruthy()
    } else {
      expect(denied.data || []).toEqual([])
    }
  })
})
