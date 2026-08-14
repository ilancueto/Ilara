import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const PROD_PROJECT_REFS = ['qbbnvdmadgomfmrsfxlo'] as const
const enabled = process.env.STAGE64_INTEGRATION === '1'
const url = process.env.STAGE64_SUPABASE_URL?.trim()
const anonKey = process.env.STAGE64_ANON_KEY?.trim()
const serviceKey = process.env.STAGE64_SERVICE_ROLE_KEY?.trim()
const adminEmail = process.env.STAGE64_USER_A_EMAIL?.trim()
const adminPassword = process.env.STAGE64_USER_A_PASSWORD?.trim()
const otherEmail = process.env.STAGE64_USER_B_EMAIL?.trim()
const otherPassword = process.env.STAGE64_USER_B_PASSWORD?.trim()
const isProd = Boolean(url && PROD_PROJECT_REFS.some((ref) => url.toLowerCase().includes(ref)))
const complete = Boolean(url && anonKey && serviceKey && adminEmail && adminPassword && otherEmail && otherPassword)
const canRun = enabled && complete && !isProd
const client = (key: string) => createClient(url!, key, { auth: { persistSession: false, autoRefreshToken: false } })
async function signed(email: string, password: string) {
  const c = client(anonKey!)
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw error
  return c
}

describe('Stage 6.4 gates', () => {
  it('no apunta a producción y falla cerrado sin configuración', () => {
    expect(isProd).toBe(false)
    if (enabled) expect(complete).toBe(true)
  })
})

describe.skipIf(!canRun)('Stage 6.4 margen real integración', () => {
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
  const comboIds: number[] = []
  const today = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())

  async function product(label: string, purchasePrice: number | null, salePrice = 1000) {
    const { data, error } = await service.from('products').insert({
      name: `s64-${label}-${Date.now()}-${Math.random()}`,
      category_id: categoryId, sale_price: salePrice, purchase_price: purchasePrice,
      stock: 100, min_stock: 1, visible_in_catalog: false,
    }).select('id, name').single()
    if (error) throw error
    productIds.push(data.id)
    return data as { id: number; name: string }
  }

  async function sale(lines: Array<Record<string, unknown>>, status = 'completed') {
    const { data, error } = await admin.rpc('create_sale_with_items', {
      p_payload: { sale: { sale_date: new Date().toISOString(), payment_method: status === 'pending_payment' ? 'credito' : 'efectivo', customer_name: 'Stage 64', status }, lines },
    })
    if (error) throw error
    const id = Number((data as { sale: { id: number } }).sale.id)
    saleIds.push(id)
    return id
  }

  async function report() {
    const result = await admin.rpc('sales_margin_report', { p_from: today, p_to: today })
    if (result.error) throw result.error
    return result.data as unknown as { summary: Record<string, unknown>; items: Array<Record<string, unknown>> }
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
    const { data, error } = await service.from('categories').insert({ name: `s64-cat-${Date.now()}` }).select('id').single()
    if (error) throw error
    categoryId = data.id
  }, 60_000)

  afterAll(async () => {
    const { data: returns } = saleIds.length ? await service.from('sale_returns').select('id').in('sale_id', saleIds) : { data: [] }
    const returnIds = (returns || []).map((row) => row.id)
    if (returnIds.length) {
      await service.from('sale_return_events').delete().in('return_id', returnIds)
      await service.from('sale_return_items').delete().in('return_id', returnIds)
      await service.from('sale_returns').delete().in('id', returnIds)
    }
    if (saleIds.length) {
      const { data: items } = await service.from('sale_items').select('id').in('sale_id', saleIds)
      const itemIds = (items || []).map((row) => row.id)
      if (itemIds.length) await service.from('sale_item_components').delete().in('sale_item_id', itemIds)
      await service.from('stock_movements').delete().in('reference_id', saleIds)
      await service.from('sale_items').delete().in('sale_id', saleIds)
      await service.from('sales').delete().in('id', saleIds)
    }
    if (comboIds.length) {
      await service.from('combo_items').delete().in('combo_id', comboIds)
      await service.from('combos').delete().in('id', comboIds)
    }
    if (productIds.length) await service.from('products').delete().in('id', productIds)
    if (categoryId) await service.from('categories').delete().eq('id', categoryId)
    if (previousAdminRole == null) await service.from('user_roles').delete().eq('user_id', adminId)
    else await service.from('user_roles').upsert({ user_id: adminId, role: previousAdminRole, updated_by: adminId })
    if (previousOtherRole == null) await service.from('user_roles').delete().eq('user_id', otherId)
    else await service.from('user_roles').upsert({ user_id: otherId, role: previousOtherRole, updated_by: adminId })
  }, 60_000)

  it('deniega anon, no-admin e intervalos inválidos', async () => {
    expect((await client(anonKey!).rpc('sales_margin_report', { p_from: today, p_to: today })).error).toBeTruthy()
    expect((await other.rpc('sales_margin_report', { p_from: today, p_to: today })).error).toBeTruthy()
    expect((await admin.rpc('sales_margin_report', { p_from: '2026-08-13', p_to: '2026-08-12' })).error?.message).toMatch(/invalid_margin_report_range/)
  })

  it('congela costo de venta y descuenta una devolución parcial', async () => {
    const p = await product('exact', 400)
    const saleId = await sale([{ line_type: 'product', product_id: p.id, quantity: 2 }])
    await service.from('products').update({ purchase_price: 900 }).eq('id', p.id)
    let value = await report()
    let row = value.items.find((item) => item.name === p.name)!
    expect(Number(row.net_revenue)).toBe(2000)
    expect(Number(row.known_cogs)).toBe(800)
    expect(Number(row.gross_margin)).toBe(1200)
    expect(Number(row.margin_percent)).toBe(60)
    const item = await service.from('sale_items').select('id').eq('sale_id', saleId).single()
    const returned = await admin.rpc('create_sale_return', { p_payload: {
      sale_id: saleId, reason: 'Stage 64 parcial', refund_method: 'efectivo', restock: true,
      idempotency_key: crypto.randomUUID(), lines: [{ sale_item_id: item.data!.id, quantity: 1 }],
    } })
    expect(returned.error).toBeNull()
    value = await report()
    row = value.items.find((candidate) => candidate.name === p.name)!
    expect(Number(row.net_revenue)).toBe(1000)
    expect(Number(row.known_cogs)).toBe(400)
    expect(Number(row.gross_margin)).toBe(600)
  })

  it('suma costos físicos del combo y excluye ventas pendientes', async () => {
    const a = await product('combo-a', 200)
    const b = await product('combo-b', 300)
    const { data: combo, error } = await service.from('combos').insert({ name: `s64-combo-${Date.now()}`, sale_price: 1500, is_active: true }).select('id, name').single()
    if (error) throw error
    comboIds.push(combo.id)
    await service.from('combo_items').insert([{ combo_id: combo.id, product_id: a.id, quantity: 2 }, { combo_id: combo.id, product_id: b.id, quantity: 1 }])
    await sale([{ line_type: 'combo', combo_id: combo.id, quantity: 1 }])
    const pending = await product('pending', 100, 9999)
    await sale([{ line_type: 'product', product_id: pending.id, quantity: 1 }], 'pending_payment')
    const value = await report()
    const row = value.items.find((item) => item.name === combo.name)!
    expect(Number(row.known_cogs)).toBe(700)
    expect(Number(row.gross_margin)).toBe(800)
    expect(value.items.some((item) => item.name === pending.name)).toBe(false)
  })

  it('marca costo faltante y no publica un margen falso', async () => {
    const p = await product('missing', null)
    await sale([{ line_type: 'product', product_id: p.id, quantity: 1 }])
    const value = await report()
    const row = value.items.find((item) => item.name === p.name)!
    expect(row.margin_complete).toBe(false)
    expect(row.gross_margin).toBeNull()
    expect(value.summary.margin_complete).toBe(false)
    expect(value.summary.gross_margin).toBeNull()
    expect(Number(value.summary.missing_cost_lines)).toBeGreaterThan(0)
  })
})
