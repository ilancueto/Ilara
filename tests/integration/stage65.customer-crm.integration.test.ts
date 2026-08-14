import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const PROD_PROJECT_REFS = ['qbbnvdmadgomfmrsfxlo'] as const
const enabled = process.env.STAGE65_INTEGRATION === '1'
const url = process.env.STAGE65_SUPABASE_URL?.trim()
const anonKey = process.env.STAGE65_ANON_KEY?.trim()
const serviceKey = process.env.STAGE65_SERVICE_ROLE_KEY?.trim()
const adminEmail = process.env.STAGE65_USER_A_EMAIL?.trim()
const adminPassword = process.env.STAGE65_USER_A_PASSWORD?.trim()
const otherEmail = process.env.STAGE65_USER_B_EMAIL?.trim()
const otherPassword = process.env.STAGE65_USER_B_PASSWORD?.trim()
const isProd = Boolean(url && PROD_PROJECT_REFS.some((ref) => url.toLowerCase().includes(ref)))
const complete = Boolean(url && anonKey && serviceKey && adminEmail && adminPassword && otherEmail && otherPassword)
const canRun = enabled && complete && !isProd
type CrmTestProfile = {
  tags: Array<{ id: number; color: string }>
  notes: Array<{ body: string }>
  consent: { granted: boolean }
  consent_history: Array<{ granted: boolean }>
  metrics: Record<string, unknown>
  activity: Array<{ type: string }>
}
const client = (key: string) => createClient(url!, key, { auth: { persistSession: false, autoRefreshToken: false } })
async function signed(email: string, password: string) {
  const c = client(anonKey!)
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw error
  return c
}

describe('Stage 6.5 gates', () => {
  it('no apunta a producción y falla cerrado sin configuración', () => {
    expect(isProd).toBe(false)
    if (enabled) expect(complete).toBe(true)
  })
})

describe.skipIf(!canRun)('Stage 6.5 CRM integración', () => {
  let admin: SupabaseClient
  let other: SupabaseClient
  let service: SupabaseClient
  let adminId = ''
  let otherId = ''
  let previousAdminRole: string | null = null
  let previousOtherRole: string | null = null
  let categoryId = 0
  let customerId = 0
  let productId = 0
  const saleIds: number[] = []
  const tagIds: number[] = []

  async function profile() {
    const result = await admin.rpc('customer_crm_profile', { p_customer_id: customerId })
    if (result.error) throw result.error
    return result.data as unknown as CrmTestProfile
  }

  async function sale(status = 'completed', quantity = 1) {
    const result = await admin.rpc('create_sale_with_items', { p_payload: {
      sale: { sale_date: new Date().toISOString(), payment_method: status === 'pending_payment' ? 'credito' : 'efectivo', customer_id: customerId, customer_name: 'Stage 65', status },
      lines: [{ line_type: 'product', product_id: productId, quantity }],
    } })
    if (result.error) throw result.error
    const id = Number(result.data.sale.id)
    saleIds.push(id)
    return id
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
    await service.from('user_roles').upsert({ user_id: otherId, role: 'vendedor', updated_by: adminId })
    const category = await service.from('categories').insert({ name: `s65-cat-${Date.now()}` }).select('id').single()
    if (category.error) throw category.error
    categoryId = category.data.id
    const customer = await service.from('customers').insert({ first_name: 'Stage', last_name: `CRM ${Date.now()}` }).select('id').single()
    if (customer.error) throw customer.error
    customerId = customer.data.id
    const product = await service.from('products').insert({ name: `s65-product-${Date.now()}`, category_id: categoryId, sale_price: 1000, purchase_price: 400, stock: 50, min_stock: 1, visible_in_catalog: false }).select('id').single()
    if (product.error) throw product.error
    productId = product.data.id
  }, 60_000)

  afterAll(async () => {
    await service.from('customer_tag_assignments').delete().eq('customer_id', customerId)
    await service.from('customer_notes').delete().eq('customer_id', customerId)
    await service.from('customer_consent_events').delete().eq('customer_id', customerId)
    if (tagIds.length) await service.from('customer_tags').delete().in('id', tagIds)
    const returns = saleIds.length ? await service.from('sale_returns').select('id').in('sale_id', saleIds) : { data: [] }
    const returnIds = (returns.data || []).map((row) => row.id)
    if (returnIds.length) {
      await service.from('sale_return_events').delete().in('return_id', returnIds)
      await service.from('sale_return_items').delete().in('return_id', returnIds)
      await service.from('sale_returns').delete().in('id', returnIds)
    }
    if (saleIds.length) {
      const items = await service.from('sale_items').select('id').in('sale_id', saleIds)
      const itemIds = (items.data || []).map((row) => row.id)
      if (itemIds.length) await service.from('sale_item_components').delete().in('sale_item_id', itemIds)
      await service.from('stock_movements').delete().in('reference_id', saleIds)
      await service.from('sale_items').delete().in('sale_id', saleIds)
      await service.from('sales').delete().in('id', saleIds)
    }
    if (productId) await service.from('products').delete().eq('id', productId)
    if (customerId) await service.from('customers').delete().eq('id', customerId)
    if (categoryId) await service.from('categories').delete().eq('id', categoryId)
    if (previousAdminRole == null) await service.from('user_roles').delete().eq('user_id', adminId)
    else await service.from('user_roles').upsert({ user_id: adminId, role: previousAdminRole, updated_by: adminId })
    if (previousOtherRole == null) await service.from('user_roles').delete().eq('user_id', otherId)
    else await service.from('user_roles').upsert({ user_id: otherId, role: previousOtherRole, updated_by: adminId })
  }, 60_000)

  it('mantiene tablas cerradas y deniega RPC a anon/vendedor', async () => {
    const anon = client(anonKey!)
    expect((await anon.from('customer_notes').select('id')).error).toBeTruthy()
    expect((await admin.from('customer_notes').select('id')).error).toBeTruthy()
    expect((await anon.rpc('customer_crm_profile', { p_customer_id: customerId })).error).toBeTruthy()
    expect((await other.rpc('customer_crm_profile', { p_customer_id: customerId })).error).toBeTruthy()
    expect((await other.from('customers').select('id').eq('id', customerId).single()).data?.id).toBe(customerId)
  })

  it('crea y asigna etiquetas de forma atómica', async () => {
    const created = await admin.rpc('customer_crm_upsert_tag', { p_id: null, p_name: `VIP ${Date.now()}`, p_color: '#7c3aed' })
    expect(created.error).toBeNull()
    const id = Number(created.data.id)
    tagIds.push(id)
    expect((await admin.rpc('customer_crm_set_tags', { p_customer_id: customerId, p_tag_ids: [id] })).error).toBeNull()
    expect((await profile()).tags).toEqual([expect.objectContaining({ id, color: '#7c3aed' })])
    expect((await admin.rpc('customer_crm_set_tags', { p_customer_id: customerId, p_tag_ids: [id, id] })).error?.message).toMatch(/invalid_customer_tags/)
  })

  it('conserva notas y consentimiento como historial auditable', async () => {
    const note = await admin.rpc('customer_crm_add_note', { p_customer_id: customerId, p_body: 'Prefiere contacto por la tarde' })
    expect(note.error).toBeNull()
    expect((await admin.rpc('customer_crm_record_consent', { p_customer_id: customerId, p_granted: true, p_source: 'whatsapp', p_evidence_note: 'Confirmado en conversación' })).error).toBeNull()
    expect((await admin.rpc('customer_crm_record_consent', { p_customer_id: customerId, p_granted: false, p_source: 'telefono', p_evidence_note: 'Solicitó no recibir campañas' })).error).toBeNull()
    let value = await profile()
    expect(value.notes[0].body).toContain('tarde')
    expect(value.consent.granted).toBe(false)
    expect(value.consent_history).toHaveLength(2)
    expect((await admin.rpc('customer_crm_archive_note', { p_note_id: Number(note.data.id) })).error).toBeNull()
    value = await profile()
    expect(value.notes).toEqual([])
    expect((await service.from('customer_notes').select('archived_at, archived_by').eq('id', note.data.id).single()).data?.archived_by).toBe(adminId)
  })

  it('protege el cliente contra borrado mientras exista historial CRM', async () => {
    const deletion = await admin.from('customers').delete().eq('id', customerId)
    expect(deletion.error).toBeTruthy()
    expect((await service.from('customers').select('id').eq('id', customerId).single()).data?.id).toBe(customerId)
  })

  it('calcula gasto neto, resta devolución y excluye pendientes', async () => {
    const completedSale = await sale('completed', 2)
    await sale('pending_payment', 1)
    const item = await service.from('sale_items').select('id').eq('sale_id', completedSale).single()
    const returned = await admin.rpc('create_sale_return', { p_payload: {
      sale_id: completedSale, reason: 'Stage 65 CRM', refund_method: 'efectivo', restock: true,
      idempotency_key: crypto.randomUUID(), lines: [{ sale_item_id: item.data!.id, quantity: 1 }],
    } })
    expect(returned.error).toBeNull()
    const value = await profile()
    expect(Number(value.metrics.sale_count)).toBe(1)
    expect(Number(value.metrics.gross_spent)).toBe(2000)
    expect(Number(value.metrics.refund_total)).toBe(1000)
    expect(Number(value.metrics.net_spent)).toBe(1000)
    expect(value.activity.map((event) => event.type)).toEqual(['return', 'sale'])
  })

  it('rechaza clientes inexistentes y entradas inválidas', async () => {
    expect((await admin.rpc('customer_crm_profile', { p_customer_id: 2147483647 })).error?.message).toMatch(/customer_not_found/)
    expect((await admin.rpc('customer_crm_add_note', { p_customer_id: customerId, p_body: '' })).error?.message).toMatch(/invalid_customer_note/)
    expect((await admin.rpc('customer_crm_record_consent', { p_customer_id: customerId, p_granted: true, p_source: 'inventado', p_evidence_note: null })).error?.message).toMatch(/invalid_customer_consent/)
  })
})
