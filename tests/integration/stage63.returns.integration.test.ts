import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const PROD_PROJECT_REFS = ['qbbnvdmadgomfmrsfxlo'] as const
const enabled = process.env.STAGE63_INTEGRATION === '1'
const url = process.env.STAGE63_SUPABASE_URL?.trim()
const anonKey = process.env.STAGE63_ANON_KEY?.trim()
const serviceKey = process.env.STAGE63_SERVICE_ROLE_KEY?.trim()
const adminEmail = process.env.STAGE63_USER_A_EMAIL?.trim()
const adminPassword = process.env.STAGE63_USER_A_PASSWORD?.trim()
const otherEmail = process.env.STAGE63_USER_B_EMAIL?.trim()
const otherPassword = process.env.STAGE63_USER_B_PASSWORD?.trim()
const isProd = Boolean(url && PROD_PROJECT_REFS.some((ref) => url.toLowerCase().includes(ref)))
const complete = Boolean(url && anonKey && serviceKey && adminEmail && adminPassword && otherEmail && otherPassword)
const canRun = enabled && complete && !isProd

const client = (key: string) => createClient(url!, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})
async function signed(email: string, password: string) {
  const c = client(anonKey!)
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw error
  return c
}

describe('Stage 6.3 gates', () => {
  it('no apunta a producción y falla cerrado sin configuración', () => {
    expect(isProd).toBe(false)
    if (enabled) expect(complete).toBe(true)
  })
})

describe.skipIf(!canRun)('Stage 6.3 devoluciones integración', () => {
  let admin: SupabaseClient
  let other: SupabaseClient
  let service: SupabaseClient
  let adminId = ''
  let otherId = ''
  let previousAdminRole: string | null = null
  let previousOtherRole: string | null = null
  let categoryId = 0
  const productIds: number[] = []
  const saleIds: number[] = []

  async function product(name: string, stock = 20, price = 1000) {
    const { data, error } = await service.from('products').insert({
      name: `s63-${name}-${Date.now()}-${Math.random()}`,
      category_id: categoryId, sale_price: price, stock, min_stock: 1,
      visible_in_catalog: false,
    }).select('id').single()
    if (error) throw error
    productIds.push(data.id)
    return data.id as number
  }

  async function sale(lines: Array<Record<string, unknown>>, status = 'completed') {
    const { data, error } = await admin.rpc('create_sale_with_items', {
      p_payload: {
        sale: {
          sale_date: new Date().toISOString(),
          payment_method: status === 'pending_payment' ? 'credito' : 'efectivo',
          customer_name: 'Stage 63',
          status,
        },
        lines,
      },
    })
    if (error) throw error
    const id = Number((data as { sale: { id: number } }).sale.id)
    saleIds.push(id)
    return id
  }

  async function saleItemId(saleId: number) {
    const { data, error } = await service.from('sale_items').select('id').eq('sale_id', saleId).single()
    if (error) throw error
    return Number(data.id)
  }

  async function createReturn(
    saleId: number, itemId: number, quantity: number,
    key = crypto.randomUUID(), method = 'efectivo', restock = true
  ) {
    return admin.rpc('create_sale_return', {
      p_payload: {
        sale_id: saleId, reason: 'Devolución de integración', refund_method: method,
        restock, idempotency_key: key,
        lines: [{ sale_item_id: itemId, quantity }],
      },
    })
  }

  beforeAll(async () => {
    service = client(serviceKey!)
    admin = await signed(adminEmail!, adminPassword!)
    other = await signed(otherEmail!, otherPassword!)
    adminId = (await admin.auth.getUser()).data.user!.id
    otherId = (await other.auth.getUser()).data.user!.id
    previousAdminRole = (await service.from('user_roles').select('role').eq('user_id', adminId).maybeSingle()).data?.role ?? null
    previousOtherRole = (await service.from('user_roles').select('role').eq('user_id', otherId).maybeSingle()).data?.role ?? null
    await service.from('user_roles').upsert({ user_id: adminId, role: 'admin', updated_by: adminId })
    await service.from('user_roles').upsert({ user_id: otherId, role: 'none', updated_by: adminId })
    const { data, error } = await service.from('categories').insert({ name: `s63-cat-${Date.now()}` }).select('id').single()
    if (error) throw error
    categoryId = data.id
  }, 60_000)

  afterAll(async () => {
    const { data: returns } = await service.from('sale_returns').select('id').in('sale_id', saleIds)
    const returnIds = (returns || []).map((r) => r.id)
    if (returnIds.length) {
      await service.from('sale_return_events').delete().in('return_id', returnIds)
      await service.from('sale_return_items').delete().in('return_id', returnIds)
      await service.from('sale_returns').delete().in('id', returnIds)
    }
    if (saleIds.length) {
      const { data: items } = await service.from('sale_items').select('id').in('sale_id', saleIds)
      const itemIds = (items || []).map((i) => i.id)
      if (itemIds.length) await service.from('sale_item_components').delete().in('sale_item_id', itemIds)
      await service.from('stock_movements').delete().in('reference_id', saleIds)
      await service.from('sale_items').delete().in('sale_id', saleIds)
      await service.from('sales').delete().in('id', saleIds)
    }
    if (productIds.length) await service.from('products').delete().in('id', productIds)
    if (categoryId) await service.from('categories').delete().eq('id', categoryId)
    if (previousAdminRole == null) await service.from('user_roles').delete().eq('user_id', adminId)
    else await service.from('user_roles').upsert({ user_id: adminId, role: previousAdminRole, updated_by: adminId })
    if (previousOtherRole == null) await service.from('user_roles').delete().eq('user_id', otherId)
    else await service.from('user_roles').upsert({ user_id: otherId, role: previousOtherRole, updated_by: adminId })
  }, 60_000)

  it('anon y no-admin no leen ni crean devoluciones', async () => {
    const anon = client(anonKey!)
    expect((await anon.from('sale_returns').select('id')).error).toBeTruthy()
    expect((await other.from('sale_returns').select('id')).data).toEqual([])
    const denied = await other.rpc('create_sale_return', { p_payload: {} })
    expect(denied.error).toBeTruthy()
  })

  it('admin devuelve parcialmente, calcula monto y reintegra stock', async () => {
    const pid = await product('partial')
    const sid = await sale([{ line_type: 'product', product_id: pid, quantity: 3 }])
    const itemId = await saleItemId(sid)
    expect((await service.from('products').select('stock').eq('id', pid).single()).data!.stock).toBe(17)
    const result = await createReturn(sid, itemId, 1)
    expect(result.error).toBeNull()
    expect(Number(result.data.refund_total)).toBe(1000)
    expect((await service.from('products').select('stock').eq('id', pid).single()).data!.stock).toBe(18)
    expect((await service.from('sale_items').select('quantity').eq('id', itemId).single()).data!.quantity).toBe(3)
  })

  it('la idempotencia no duplica crédito ni stock', async () => {
    const pid = await product('idem')
    const sid = await sale([{ line_type: 'product', product_id: pid, quantity: 1 }])
    const itemId = await saleItemId(sid)
    const key = crypto.randomUUID()
    const first = await createReturn(sid, itemId, 1, key)
    const replay = await createReturn(sid, itemId, 1, key)
    expect(first.error).toBeNull()
    expect(replay.error).toBeNull()
    expect(replay.data.idempotent_replay).toBe(true)
    expect((await service.from('products').select('stock').eq('id', pid).single()).data!.stock).toBe(20)
  })

  it('impide devolver más que la cantidad disponible', async () => {
    const pid = await product('limit')
    const sid = await sale([{ line_type: 'product', product_id: pid, quantity: 1 }])
    const itemId = await saleItemId(sid)
    expect((await createReturn(sid, itemId, 2)).error?.message).toMatch(/return_quantity_exceeds_available/)
  })

  it('serializa devoluciones concurrentes de la misma venta', async () => {
    const pid = await product('concurrent')
    const sid = await sale([{ line_type: 'product', product_id: pid, quantity: 2 }])
    const itemId = await saleItemId(sid)
    const results = await Promise.all([
      createReturn(sid, itemId, 2),
      createReturn(sid, itemId, 2),
    ])
    expect(results.filter((r) => !r.error)).toHaveLength(1)
    expect(results.filter((r) => r.error)).toHaveLength(1)
    expect((await service.from('products').select('stock').eq('id', pid).single()).data!.stock).toBe(20)
  })

  it('venta pendiente cancela crédito y rechaza reintegro monetario', async () => {
    const pid = await product('credit')
    const sid = await sale([{ line_type: 'product', product_id: pid, quantity: 1 }], 'pending_payment')
    const itemId = await saleItemId(sid)
    expect((await createReturn(sid, itemId, 1, crypto.randomUUID(), 'efectivo')).error?.message)
      .toMatch(/pending_sale_requires_credit_cancellation/)
    expect((await createReturn(sid, itemId, 1, crypto.randomUUID(), 'credito_cancelado')).error).toBeNull()
  })

  it('snapshot de combo restaura la composición vendida aunque cambie después', async () => {
    const pid = await product('combo', 20, 400)
    const { data: combo, error: comboError } = await service.from('combos').insert({
      name: `s63-combo-${Date.now()}`, sale_price: 1000, is_active: true,
    }).select('id').single()
    if (comboError) throw comboError
    const { data: ci, error: ciError } = await service.from('combo_items').insert({
      combo_id: combo.id, product_id: pid, quantity: 2,
    }).select('id').single()
    if (ciError) throw ciError
    const sid = await sale([{ line_type: 'combo', combo_id: combo.id, quantity: 1 }])
    const itemId = await saleItemId(sid)
    expect((await service.from('products').select('stock').eq('id', pid).single()).data!.stock).toBe(18)
    await service.from('combo_items').update({ quantity: 5 }).eq('id', ci.id)
    expect((await createReturn(sid, itemId, 1)).error).toBeNull()
    expect((await service.from('products').select('stock').eq('id', pid).single()).data!.stock).toBe(20)
    await service.from('combo_items').delete().eq('id', ci.id)
    await service.from('combos').delete().eq('id', combo.id)
  })

  it('venta con devolución no puede borrarse y duplicar stock', async () => {
    const pid = await product('delete')
    const sid = await sale([{ line_type: 'product', product_id: pid, quantity: 1 }])
    const itemId = await saleItemId(sid)
    expect((await createReturn(sid, itemId, 1)).error).toBeNull()
    const deletion = await admin.rpc('delete_sale_and_restore_stock', { p_sale_id: sid })
    expect(deletion.error?.message).toMatch(/sale_has_returns/)
    expect((await service.from('sales').select('id').eq('id', sid).single()).data!.id).toBe(sid)
  })

  it('authenticated no puede escribir directamente las tablas', async () => {
    const direct = await admin.from('sale_returns').insert({
      sale_id: 1, reason: 'directo', refund_method: 'efectivo',
      refund_total: 1, restock: false, idempotency_key: crypto.randomUUID(), created_by: adminId,
    })
    expect(direct.error).toBeTruthy()
  })
})
