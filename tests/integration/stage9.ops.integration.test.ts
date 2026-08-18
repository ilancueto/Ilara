/**
 * Integración Stage 9 — cliente, margen y devoluciones de catálogo.
 * Habilitación: STAGE9_INTEGRATION=1 (o STAGE61/STAGE1). Bloquea prod.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function withAccess<T extends { idempotency_key: string }>(payload: T) {
  return {
    ...payload,
    access_capability_hash: createHash('sha256').update(`plain-${payload.idempotency_key}`).digest('hex'),
  }
}

const PROD_PROJECT_REFS = ['qbbnvdmadgomfmrsfxlo'] as const
const enabled =
  process.env.STAGE9_INTEGRATION === '1' ||
  process.env.STAGE61_INTEGRATION === '1' ||
  process.env.STAGE1_INTEGRATION === '1'
const url =
  process.env.STAGE9_SUPABASE_URL?.trim() ||
  process.env.STAGE61_SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const anonKey =
  process.env.STAGE9_ANON_KEY?.trim() ||
  process.env.STAGE61_ANON_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
const serviceKey =
  process.env.STAGE9_SERVICE_ROLE_KEY?.trim() ||
  process.env.STAGE61_SERVICE_ROLE_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const adminEmail =
  process.env.STAGE9_USER_A_EMAIL?.trim() || process.env.STAGE61_USER_A_EMAIL?.trim()
const adminPassword =
  process.env.STAGE9_USER_A_PASSWORD?.trim() || process.env.STAGE61_USER_A_PASSWORD?.trim()
const otherEmail =
  process.env.STAGE9_USER_B_EMAIL?.trim() || process.env.STAGE61_USER_B_EMAIL?.trim()
const otherPassword =
  process.env.STAGE9_USER_B_PASSWORD?.trim() || process.env.STAGE61_USER_B_PASSWORD?.trim()

const isProd = Boolean(url && PROD_PROJECT_REFS.some((ref) => url.toLowerCase().includes(ref)))
const complete = Boolean(url && anonKey && serviceKey && adminEmail && adminPassword && otherEmail && otherPassword)
const canRun = Boolean(enabled && complete && !isProd)
const client = (key: string) =>
  createClient(url!, key, { auth: { persistSession: false, autoRefreshToken: false } })

async function signed(email: string, password: string) {
  const c = client(anonKey!)
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw error
  return c
}

const today = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date())

describe('Stage 9 gates', () => {
  it('no apunta a producción y exige credenciales si está habilitado', () => {
    expect(isProd).toBe(false)
    if (enabled) expect(complete).toBe(true)
  })
})

describe.skipIf(!canRun)('Stage 9 integración operativa', () => {
  let service: SupabaseClient
  let admin: SupabaseClient
  let other: SupabaseClient
  let adminId = ''
  let previousAdminRole: string | null = null
  let previousOtherRole: string | null = null
  let categoryId = 0
  const productIds: number[] = []
  const customerIds: number[] = []
  const orderIds: string[] = []
  const quoteIds: string[] = []
  const saleIds: number[] = []
  let sharedPhone = ''
  let uniquePhone = ''
  let missingCostPhone = ''

  async function quote(amount = 500) {
    const { data, error } = await service.from('shipping_quotes').insert({
      quote_group_id: crypto.randomUUID(),
      provider: 'envia',
      destination_postal_code: '1000',
      destination_city: 'Buenos Aires',
      destination_state: 'CABA',
      destination_province_id: '02',
      destination_locality_id: '02000010',
      destination_street: 'AV CORRIENTES',
      destination_number: '1000',
      destination_formatted_address: 'AV CORRIENTES 1000',
      carrier: 'test',
      carrier_description: 'Test',
      service: 'std',
      service_description: 'Std',
      amount,
      currency: 'ARS',
      request_ip_hash: 'b'.repeat(64),
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    }).select('id').single()
    if (error || !data?.id) throw error || new Error('quote')
    quoteIds.push(data.id)
    return data.id as string
  }

  async function product(label: string, opts: { stock?: number; sale?: number; cost?: number | null } = {}) {
    const { data, error } = await service.from('products').insert({
      name: `s9-${label}-${Date.now()}-${Math.random()}`,
      category_id: categoryId,
      sale_price: opts.sale ?? 1000,
      purchase_price: opts.cost === undefined ? 400 : opts.cost,
      stock: opts.stock ?? 10,
      min_stock: 1,
      visible_in_catalog: true,
      discount_percentage: 0,
    }).select('id, stock').single()
    if (error) throw error
    productIds.push(data.id)
    return data as { id: number; stock: number }
  }

  async function createOrder(phone: string, productId: number, quantity = 1, name = 'Stage 9') {
    const { data, error } = await client(anonKey!).rpc('create_catalog_order', {
      p_payload: withAccess({
        idempotency_key: crypto.randomUUID(),
        shipping_quote_id: await quote(),
        customer_name: name,
        customer_phone: phone,
        customer_email: `${phone}@example.test`,
        lines: [{ line_type: 'product', product_id: productId, quantity }],
      }),
    })
    if (error) throw error
    orderIds.push(data.order_id)
    return data as { order_id: string; order_number: string; total: number }
  }

  beforeAll(async () => {
    service = client(serviceKey!)
    admin = await signed(adminEmail!, adminPassword!)
    other = await signed(otherEmail!, otherPassword!)
    adminId = (await admin.auth.getUser()).data.user!.id
    const otherId = (await other.auth.getUser()).data.user!.id
    const { data: ar } = await service.from('user_roles').select('role').eq('user_id', adminId).maybeSingle()
    const { data: br } = await service.from('user_roles').select('role').eq('user_id', otherId).maybeSingle()
    previousAdminRole = ar?.role ?? null
    previousOtherRole = br?.role ?? null
    await service.from('user_roles').upsert({ user_id: adminId, role: 'admin', updated_by: adminId })
    await service.from('user_roles').upsert({ user_id: otherId, role: 'none', updated_by: adminId })
    const { data: cat, error: catErr } = await service.from('categories').insert({
      name: `s9-cat-${Date.now()}`,
    }).select('id').single()
    if (catErr) throw catErr
    categoryId = cat.id
    sharedPhone = `2998${String(Date.now()).slice(-6)}`
    uniquePhone = `2997${String(Date.now()).slice(-6)}`
    missingCostPhone = `2996${String(Date.now()).slice(-6)}`
  }, 60_000)

  afterAll(async () => {
    if (orderIds.length) {
      await service.from('order_return_items').delete().in(
        'return_id',
        ((await service.from('order_returns').select('id').in('order_id', orderIds)).data || []).map((r) => r.id)
      )
      await service.from('order_return_events').delete().in(
        'return_id',
        ((await service.from('order_returns').select('id').in('order_id', orderIds)).data || []).map((r) => r.id)
      )
      await service.from('order_returns').delete().in('order_id', orderIds)
      await service.from('order_payments').delete().in('order_id', orderIds)
      await service.from('shipping_quotes').update({ order_id: null, consumed_at: null }).in('order_id', orderIds)
      await service.from('order_status_events').delete().in('order_id', orderIds)
      await service.from('order_items').delete().in('order_id', orderIds)
      await service.from('orders').delete().in('id', orderIds)
    }
    if (quoteIds.length) await service.from('shipping_quotes').delete().in('id', quoteIds)
    if (saleIds.length) {
      const { data: items } = await service.from('sale_items').select('id').in('sale_id', saleIds)
      const itemIds = (items || []).map((i) => i.id)
      if (itemIds.length) await service.from('sale_item_components').delete().in('sale_item_id', itemIds)
      await service.from('sale_items').delete().in('sale_id', saleIds)
      await service.from('sales').delete().in('id', saleIds)
    }
    if (productIds.length) await service.from('products').delete().in('id', productIds)
    if (customerIds.length) await service.from('customers').delete().in('id', customerIds)
    if (categoryId) await service.from('categories').delete().eq('id', categoryId)
    if (previousAdminRole === null) await service.from('user_roles').delete().eq('user_id', adminId)
    else await service.from('user_roles').upsert({ user_id: adminId, role: previousAdminRole, updated_by: adminId })
    const otherId = (await other.auth.getUser()).data.user!.id
    if (previousOtherRole === null) await service.from('user_roles').delete().eq('user_id', otherId)
    else await service.from('user_roles').upsert({ user_id: otherId, role: previousOtherRole, updated_by: adminId })
  }, 60_000)

  it('asocia pedido a cliente existente y no duplica', async () => {
    const created = await service.from('customers').insert({
      first_name: 'Mara', last_name: 'Existente', phone: uniquePhone, email: 'mejor@example.test',
    }).select('id').single()
    if (created.error) throw created.error
    customerIds.push(created.data.id)
    const prod = await product('link')
    const first = await createOrder(uniquePhone, prod.id, 1, 'Mara Nueva')
    const second = await createOrder(uniquePhone, prod.id, 1, 'Mara Nueva')
    const { data: orders } = await service.from('orders').select('id, customer_id, customer_name').in('id', [first.order_id, second.order_id])
    expect(orders?.every((o) => o.customer_id === created.data.id)).toBe(true)
    const { data: samePhone } = await service.from('customers').select('id, email').eq('phone', uniquePhone)
    expect(samePhone).toHaveLength(1)
    expect(samePhone?.[0].email).toBe('mejor@example.test')
    const { data: snapshots } = await service.from('orders').select('customer_name').eq('id', first.order_id).single()
    expect(snapshots?.customer_name).toBe('Mara Nueva')
  })

  it('crea cliente nuevo si el teléfono no existe', async () => {
    const prod = await product('newc')
    const phone = `2995${String(Date.now()).slice(-6)}`
    const order = await createOrder(phone, prod.id, 1, 'Ana Nueva')
    const { data: row } = await service.from('orders').select('customer_id').eq('id', order.order_id).single()
    expect(row?.customer_id).toBeTruthy()
    if (row?.customer_id) customerIds.push(row.customer_id)
    const profile = await admin.rpc('customer_crm_profile', { p_customer_id: row!.customer_id })
    expect(profile.error).toBeNull()
    expect(Number((profile.data as { catalog_orders: { order_count: number } }).catalog_orders.order_count)).toBeGreaterThan(0)
  })

  it('no asocia si el teléfono es ambiguo', async () => {
    await service.from('customers').insert([
      { first_name: 'A', last_name: 'Uno', phone: sharedPhone },
      { first_name: 'B', last_name: 'Dos', phone: sharedPhone },
    ]).select('id').then((res) => {
      if (res.error) throw res.error
      customerIds.push(...res.data.map((r) => r.id))
    })
    const prod = await product('amb')
    const order = await createOrder(sharedPhone, prod.id, 1, 'Ambiguo')
    const { data: row } = await service.from('orders').select('customer_id').eq('id', order.order_id).single()
    expect(row?.customer_id).toBeNull()
  })

  it('POS y catálogo comparten inventario', async () => {
    const prod = await product('share', { stock: 10 })
    const order = await createOrder(`2994${String(Date.now()).slice(-6)}`, prod.id)
    const confirm = await admin.rpc('transition_catalog_order', {
      p_order_id: order.order_id, p_to_status: 'confirmed', p_reason: null,
    })
    expect(confirm.error).toBeNull()
    const afterOrder = await service.from('products').select('stock').eq('id', prod.id).single()
    expect(afterOrder.data?.stock).toBe(9)
    const sale = await admin.rpc('create_sale_with_items', {
      p_payload: {
        sale: { sale_date: new Date().toISOString(), payment_method: 'efectivo', customer_name: 'POS', status: 'completed' },
        lines: [{ line_type: 'product', product_id: prod.id, quantity: 1 }],
      },
    })
    if (sale.error) throw sale.error
    saleIds.push(Number((sale.data as { sale: { id: number } }).sale.id))
    const afterSale = await service.from('products').select('stock').eq('id', prod.id).single()
    expect(afterSale.data?.stock).toBe(8)
  })

  it('margen POS no se altera y catálogo usa snapshot', async () => {
    const prod = await product('margin', { cost: 200, sale: 1000, stock: 20 })
    const posSale = await admin.rpc('create_sale_with_items', {
      p_payload: {
        sale: { sale_date: new Date().toISOString(), payment_method: 'efectivo', customer_name: 'POS margen', status: 'completed' },
        lines: [{ line_type: 'product', product_id: prod.id, quantity: 1 }],
      },
    })
    if (posSale.error) throw posSale.error
    saleIds.push(Number((posSale.data as { sale: { id: number } }).sale.id))
    const pos = await admin.rpc('sales_margin_report', { p_from: today, p_to: today })
    if (pos.error) throw pos.error
    const commercialPos = await admin.rpc('commercial_margin_report', {
      p_from: today, p_to: today, p_channel: 'pos',
    })
    if (commercialPos.error) throw commercialPos.error
    const posSummary = (pos.data as { summary: Record<string, unknown> }).summary
    const wrapped = (commercialPos.data as { summary: Record<string, unknown>; pos: Record<string, unknown> })
    expect(Number(wrapped.pos.net_revenue)).toBe(Number(posSummary.net_revenue))
    expect(Number(wrapped.pos.known_cogs)).toBe(Number(posSummary.known_cogs))
    expect(wrapped.pos.gross_margin == null ? null : Number(wrapped.pos.gross_margin))
      .toBe(posSummary.gross_margin == null ? null : Number(posSummary.gross_margin))

    const order = await createOrder(`2993${String(Date.now()).slice(-6)}`, prod.id)
    const confirm = await admin.rpc('transition_catalog_order', {
      p_order_id: order.order_id, p_to_status: 'confirmed', p_reason: null,
    })
    expect(confirm.error).toBeNull()
    await service.from('products').update({ purchase_price: 9999 }).eq('id', prod.id)
    const catalog = await admin.rpc('commercial_margin_report', {
      p_from: today, p_to: today, p_channel: 'catalog',
    })
    if (catalog.error) throw catalog.error
    const catalogSummary = (catalog.data as { catalog: { known_cogs: number; margin_complete: boolean } }).catalog
    expect(Number(catalogSummary.known_cogs)).toBeGreaterThanOrEqual(200)
    expect(Number(catalogSummary.known_cogs)).toBeLessThan(9000)
  })

  it('costo faltante no inventa margen', async () => {
    const prod = await product('nocost', { cost: null, sale: 800 })
    const order = await createOrder(missingCostPhone, prod.id)
    await admin.rpc('transition_catalog_order', {
      p_order_id: order.order_id, p_to_status: 'confirmed', p_reason: null,
    })
    const { data: linked } = await service.from('orders').select('customer_id').eq('id', order.order_id).single()
    if (linked?.customer_id) customerIds.push(linked.customer_id)
    const report = await admin.rpc('commercial_margin_report', {
      p_from: today, p_to: today, p_channel: 'catalog',
    })
    if (report.error) throw report.error
    const catalog = (report.data as { catalog: { margin_complete: boolean; gross_margin: number | null; missing_cost_orders: number } }).catalog
    expect(catalog.margin_complete).toBe(false)
    expect(catalog.gross_margin).toBeNull()
    expect(Number(catalog.missing_cost_orders)).toBeGreaterThan(0)
  })

  it('devolución no excede cantidades, restockea una vez y el reembolso no vuelve a tocar stock', async () => {
    const prod = await product('ret', { stock: 6, cost: 100, sale: 500 })
    const order = await createOrder(`2992${String(Date.now()).slice(-6)}`, prod.id, 2)
    const confirm = await admin.rpc('transition_catalog_order', {
      p_order_id: order.order_id, p_to_status: 'confirmed', p_reason: null,
    })
    expect(confirm.error).toBeNull()
    const { data: items } = await service.from('order_items').select('id, quantity').eq('order_id', order.order_id)
    const itemId = items?.[0].id as number
    const { data: afterConfirm } = await service.from('products').select('stock').eq('id', prod.id).single()
    expect(afterConfirm?.stock).toBe(4)

    const over = await admin.rpc('create_order_return', {
      p_payload: {
        order_id: order.order_id,
        reason: 'Exceso de prueba',
        refund_action: 'none',
        restock: true,
        apply_payment_refund: false,
        idempotency_key: crypto.randomUUID(),
        lines: [{ order_item_id: itemId, quantity: 3 }],
      },
    })
    expect(over.error?.message || '').toMatch(/return_quantity_exceeds_available/)

    const ok = await admin.rpc('create_order_return', {
      p_payload: {
        order_id: order.order_id,
        reason: 'Cambio de talle',
        refund_action: 'record_manual',
        restock: true,
        apply_payment_refund: false,
        idempotency_key: crypto.randomUUID(),
        lines: [{ order_item_id: itemId, quantity: 2 }],
      },
    })
    expect(ok.error).toBeNull()
    expect(ok.data.restock).toBe(true)
    const { data: afterReturn } = await service.from('products').select('stock').eq('id', prod.id).single()
    expect(afterReturn?.stock).toBe(6)

    const again = await admin.rpc('create_order_return', {
      p_payload: {
        order_id: order.order_id,
        reason: 'Segunda vez',
        refund_action: 'none',
        restock: true,
        apply_payment_refund: false,
        idempotency_key: crypto.randomUUID(),
        lines: [{ order_item_id: itemId, quantity: 1 }],
      },
    })
    expect(again.error?.message || '').toMatch(/return_quantity_exceeds_available/)

    const { data: version } = await service.from('payment_pricing_versions').select('id').limit(1).maybeSingle()
    if (version?.id) {
      const payment = await service.from('order_payments').insert({
        order_id: order.order_id,
        pricing_version_id: version.id,
        method: 'mercadopago',
        provider: 'mercadopago',
        status: 'approved',
        amount_due: 1000,
        base_amount: 1000,
        public_amount: 1000,
        refunded_amount: 0,
        transfer_saving: 0,
        currency: 'ARS',
        idempotency_key: crypto.randomUUID(),
        external_reference: `s9-${order.order_id}`,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      }).select('id').single()
      if (!payment.error && payment.data) {
        const refunded = await admin.rpc('admin_refund_catalog_payment', {
          p_payment_id: payment.data.id,
          p_amount: 100,
          p_reason: 'Reembolso de prueba',
        })
        expect(refunded.error).toBeNull()
        const { data: afterRefund } = await service.from('products').select('stock').eq('id', prod.id).single()
        expect(afterRefund?.stock).toBe(6)
      }
    }

    const { data: linked } = await service.from('orders').select('customer_id').eq('id', order.order_id).single()
    if (linked?.customer_id) customerIds.push(linked.customer_id)
  })

  it('anon no enumera clientes, pedidos, pagos ni devoluciones', async () => {
    const anon = client(anonKey!)
    for (const table of ['customers', 'orders', 'order_payments', 'order_returns', 'order_return_items', 'order_item_components']) {
      const { data, error } = await anon.from(table).select('*').limit(1)
      expect(error, table).toBeTruthy()
      expect(data == null || data.length === 0).toBe(true)
    }
    expect((await anon.rpc('customer_crm_profile', { p_customer_id: 1 })).error).toBeTruthy()
    expect((await anon.rpc('commercial_margin_report', { p_from: today, p_to: today })).error).toBeTruthy()
    expect((await anon.rpc('create_order_return', { p_payload: {} })).error).toBeTruthy()
    expect((await other.rpc('create_order_return', {
      p_payload: { order_id: crypto.randomUUID(), reason: 'no', refund_action: 'none', restock: false, idempotency_key: crypto.randomUUID(), lines: [] },
    })).error).toBeTruthy()
  })
})
