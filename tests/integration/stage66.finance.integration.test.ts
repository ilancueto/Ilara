import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const PROD_PROJECT_REFS = ['qbbnvdmadgomfmrsfxlo'] as const
const enabled = process.env.STAGE66_INTEGRATION === '1'
const url = process.env.STAGE66_SUPABASE_URL?.trim()
const anonKey = process.env.STAGE66_ANON_KEY?.trim()
const serviceKey = process.env.STAGE66_SERVICE_ROLE_KEY?.trim()
const adminEmail = process.env.STAGE66_USER_A_EMAIL?.trim()
const adminPassword = process.env.STAGE66_USER_A_PASSWORD?.trim()
const otherEmail = process.env.STAGE66_USER_B_EMAIL?.trim()
const otherPassword = process.env.STAGE66_USER_B_PASSWORD?.trim()
const isProd = Boolean(url && PROD_PROJECT_REFS.some((ref) => url.toLowerCase().includes(ref)))
const complete = Boolean(url && anonKey && serviceKey && adminEmail && adminPassword && otherEmail && otherPassword)
const canRun = enabled && complete && !isProd
const client = (key: string) => createClient(url!, key, { auth: { persistSession: false, autoRefreshToken: false } })
async function signed(email: string, password: string) {
  const value = client(anonKey!)
  const { error } = await value.auth.signInWithPassword({ email, password })
  if (error) throw error
  return value
}

type Snapshot = {
  summary: { receivable_open: number; payable_open: number; period_inflow: number; period_outflow: number }
  accounts: Array<{ id: string; kind: string; sale_id: number | null; net_amount: number; paid_amount: number; balance: number; status: string; movements: unknown[] }>
  reconciliation: Array<{ payment_method: string; inflow: number; outflow: number }>
}

describe('Stage 6.6 gates', () => {
  it('no apunta a producción y falla cerrado sin configuración', () => {
    expect(isProd).toBe(false)
    if (enabled) expect(complete).toBe(true)
  })
})

describe.skipIf(!canRun)('Stage 6.6 finanzas integración', () => {
  let admin: SupabaseClient
  let other: SupabaseClient
  let service: SupabaseClient
  let adminId = ''
  let otherId = ''
  let previousAdminRole: string | null = null
  let previousOtherRole: string | null = null
  let categoryId = 0
  let productId = 0
  let saleId = 0
  let cashSaleId = 0
  let receivableId = ''
  let payableId = ''
  const expenseIds: string[] = []
  const today = new Date().toISOString().slice(0, 10)

  async function snapshot(): Promise<Snapshot> {
    const result = await admin.rpc('finance_stage66_snapshot', { p_from: today, p_to: today })
    if (result.error) throw result.error
    return result.data as unknown as Snapshot
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
    const category = await service.from('categories').insert({ name: `s66-cat-${Date.now()}` }).select('id').single()
    if (category.error) throw category.error
    categoryId = category.data.id
    const product = await service.from('products').insert({
      name: `s66-product-${Date.now()}`, category_id: categoryId, sale_price: 1000,
      purchase_price: 400, stock: 20, min_stock: 1, visible_in_catalog: false,
    }).select('id').single()
    if (product.error) throw product.error
    productId = product.data.id
  }, 60_000)

  afterAll(async () => {
    if (receivableId || payableId) {
      const ids = [receivableId, payableId].filter(Boolean)
      const movements = await service.from('financial_movements').select('expense_id').in('account_id', ids)
      expenseIds.push(...(movements.data || []).map((row) => row.expense_id).filter(Boolean))
      await service.from('financial_movements').delete().in('account_id', ids)
      await service.from('financial_accounts').delete().in('id', ids)
    }
    if (expenseIds.length) await service.from('expenses').delete().in('id', expenseIds)
    for (const currentSaleId of [saleId, cashSaleId].filter(Boolean)) {
      const returns = await service.from('sale_returns').select('id').eq('sale_id', currentSaleId)
      const returnIds = (returns.data || []).map((row) => row.id)
      if (returnIds.length) {
        await service.from('sale_return_events').delete().in('return_id', returnIds)
        await service.from('sale_return_items').delete().in('return_id', returnIds)
        await service.from('sale_returns').delete().in('id', returnIds)
      }
      const items = await service.from('sale_items').select('id').eq('sale_id', currentSaleId)
      const itemIds = (items.data || []).map((row) => row.id)
      if (itemIds.length) await service.from('sale_item_components').delete().in('sale_item_id', itemIds)
      await service.from('stock_movements').delete().eq('reference_id', currentSaleId)
      await service.from('sale_items').delete().eq('sale_id', currentSaleId)
      await service.from('sales').delete().eq('id', currentSaleId)
    }
    if (productId) await service.from('products').delete().eq('id', productId)
    if (categoryId) await service.from('categories').delete().eq('id', categoryId)
    if (previousAdminRole == null) await service.from('user_roles').delete().eq('user_id', adminId)
    else await service.from('user_roles').upsert({ user_id: adminId, role: previousAdminRole, updated_by: adminId })
    if (previousOtherRole == null) await service.from('user_roles').delete().eq('user_id', otherId)
    else await service.from('user_roles').upsert({ user_id: otherId, role: previousOtherRole, updated_by: adminId })
  }, 60_000)

  it('cierra tablas y RPC para anon/vendedor', async () => {
    const anon = client(anonKey!)
    expect((await anon.from('financial_accounts').select('id')).error).toBeTruthy()
    expect((await admin.from('financial_accounts').select('id')).error).toBeTruthy()
    expect((await anon.rpc('finance_stage66_snapshot', { p_from: today, p_to: today })).error).toBeTruthy()
    expect((await other.rpc('finance_stage66_snapshot', { p_from: today, p_to: today })).error).toBeTruthy()
  })

  it('crea CxC automática, cobra parcial e impide sobrepago', async () => {
    const sale = await admin.rpc('create_sale_with_items', { p_payload: {
      sale: { sale_date: new Date().toISOString(), payment_method: 'credito', customer_name: 'Cliente Stage 66', status: 'pending_payment' },
      lines: [{ line_type: 'product', product_id: productId, quantity: 2 }],
    } })
    expect(sale.error).toBeNull()
    saleId = Number((sale.data as { sale: { id: number } }).sale.id)
    let value = await snapshot()
    const account = value.accounts.find((row) => row.sale_id === saleId)!
    receivableId = account.id
    expect(Number(account.balance)).toBe(2000)

    const key = crypto.randomUUID()
    const partial = await admin.rpc('finance_record_settlement', {
      p_account_id: receivableId, p_amount: 500, p_payment_method: 'transferencia',
      p_occurred_at: new Date().toISOString(), p_note: 'Primer pago parcial', p_idempotency_key: key,
    })
    expect(partial.error).toBeNull()
    expect((await admin.rpc('finance_record_settlement', {
      p_account_id: receivableId, p_amount: 500, p_payment_method: 'transferencia',
      p_occurred_at: new Date().toISOString(), p_note: 'Reintento idempotente', p_idempotency_key: key,
    })).error).toBeNull()
    expect((await admin.rpc('finance_record_settlement', {
      p_account_id: receivableId, p_amount: 1600, p_payment_method: 'efectivo',
      p_occurred_at: new Date().toISOString(), p_note: null, p_idempotency_key: crypto.randomUUID(),
    })).error?.message).toMatch(/settlement_exceeds_balance/)
    value = await snapshot()
    expect(Number(value.accounts.find((row) => row.id === receivableId)!.paid_amount)).toBe(500)
    expect(value.accounts.find((row) => row.id === receivableId)!.movements).toHaveLength(1)
  })

  it('descuenta la nota de crédito y salda sólo el neto restante', async () => {
    const item = await service.from('sale_items').select('id').eq('sale_id', saleId).single()
    const returned = await admin.rpc('create_sale_return', { p_payload: {
      sale_id: saleId, reason: 'Devolución Stage 66', refund_method: 'credito_cancelado', restock: true,
      idempotency_key: crypto.randomUUID(), lines: [{ sale_item_id: item.data!.id, quantity: 1 }],
    } })
    expect(returned.error).toBeNull()
    let value = await snapshot()
    expect(Number(value.accounts.find((row) => row.id === receivableId)!.net_amount)).toBe(1000)
    expect(Number(value.accounts.find((row) => row.id === receivableId)!.balance)).toBe(500)
    expect((await admin.rpc('finance_record_settlement', {
      p_account_id: receivableId, p_amount: 500, p_payment_method: 'efectivo',
      p_occurred_at: new Date().toISOString(), p_note: 'Saldo final', p_idempotency_key: crypto.randomUUID(),
    })).error).toBeNull()
    value = await snapshot()
    expect(value.accounts.find((row) => row.id === receivableId)!.status).toBe('settled')
    expect((await service.from('sales').select('status').eq('id', saleId).single()).data?.status).toBe('completed')
  })

  it('paga CxP, genera gasto y concilia sin duplicar la venta a crédito', async () => {
    const cashSale = await admin.rpc('create_sale_with_items', { p_payload: {
      sale: { sale_date: new Date().toISOString(), payment_method: 'efectivo', customer_name: 'Contado Stage 66', status: 'completed' },
      lines: [{ line_type: 'product', product_id: productId, quantity: 1 }],
    } })
    expect(cashSale.error).toBeNull()
    cashSaleId = Number((cashSale.data as { sale: { id: number } }).sale.id)
    const cashItem = await service.from('sale_items').select('id').eq('sale_id', cashSaleId).single()
    expect((await admin.rpc('create_sale_return', { p_payload: {
      sale_id: cashSaleId, reason: 'Reembolso de caja Stage 66', refund_method: 'efectivo', restock: true,
      idempotency_key: crypto.randomUUID(), lines: [{ sale_item_id: cashItem.data!.id, quantity: 1 }],
    } })).error).toBeNull()

    const created = await admin.rpc('finance_create_payable', {
      p_counterparty: 'Proveedor Stage 66', p_description: 'Insumos de prueba', p_amount: 600, p_due_date: today,
    })
    expect(created.error).toBeNull()
    payableId = String((created.data as { id: string }).id)
    const paid = await admin.rpc('finance_record_settlement', {
      p_account_id: payableId, p_amount: 600, p_payment_method: 'mercadopago',
      p_occurred_at: new Date().toISOString(), p_note: 'Pago completo proveedor', p_idempotency_key: crypto.randomUUID(),
    })
    expect(paid.error).toBeNull()
    const expenseId = String((paid.data as { expense_id: string }).expense_id)
    expenseIds.push(expenseId)
    expect((await service.from('expenses').select('amount, payment_method').eq('id', expenseId).single()).data).toEqual(expect.objectContaining({ payment_method: 'mercadopago' }))
    const value = await snapshot()
    expect(Number(value.summary.receivable_open)).toBe(0)
    expect(Number(value.summary.payable_open)).toBe(0)
    expect(Number(value.summary.period_inflow)).toBe(2000)
    expect(Number(value.summary.period_outflow)).toBe(1600)
    expect(Number(value.reconciliation.find((line) => line.payment_method === 'efectivo')!.outflow)).toBe(1000)
  })
})
