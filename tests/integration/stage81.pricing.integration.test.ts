/**
 * Integración Stage 8.1 — precios versionados.
 * STAGE8_INTEGRATION=1 o STAGE81_INTEGRATION=1. Fail-closed si falta config. Bloquea prod.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const PROD_PROJECT_REFS = ['qbbnvdmadgomfmrsfxlo'] as const
const enabled = process.env.STAGE81_INTEGRATION === '1' || process.env.STAGE8_INTEGRATION === '1'
const url =
  process.env.STAGE81_SUPABASE_URL?.trim() ||
  process.env.STAGE8_SUPABASE_URL?.trim() ||
  process.env.STAGE61_SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const anonKey =
  process.env.STAGE81_ANON_KEY?.trim() ||
  process.env.STAGE8_ANON_KEY?.trim() ||
  process.env.STAGE61_ANON_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
const serviceKey =
  process.env.STAGE81_SERVICE_ROLE_KEY?.trim() ||
  process.env.STAGE8_SERVICE_ROLE_KEY?.trim() ||
  process.env.STAGE61_SERVICE_ROLE_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const adminEmail =
  process.env.STAGE81_USER_A_EMAIL?.trim() ||
  process.env.STAGE8_USER_A_EMAIL?.trim() ||
  process.env.STAGE61_USER_A_EMAIL?.trim()
const adminPassword =
  process.env.STAGE81_USER_A_PASSWORD?.trim() ||
  process.env.STAGE8_USER_A_PASSWORD?.trim() ||
  process.env.STAGE61_USER_A_PASSWORD?.trim()
const otherEmail =
  process.env.STAGE81_USER_B_EMAIL?.trim() ||
  process.env.STAGE8_USER_B_EMAIL?.trim() ||
  process.env.STAGE61_USER_B_EMAIL?.trim()
const otherPassword =
  process.env.STAGE81_USER_B_PASSWORD?.trim() ||
  process.env.STAGE8_USER_B_PASSWORD?.trim() ||
  process.env.STAGE61_USER_B_PASSWORD?.trim()

function isProductionTarget(targetUrl: string | undefined): boolean {
  if (!targetUrl) return false
  return PROD_PROJECT_REFS.some((ref) => targetUrl.toLowerCase().includes(ref))
}

const isProd = isProductionTarget(url)
const complete = Boolean(url && anonKey && serviceKey && adminEmail && adminPassword && otherEmail && otherPassword)
const canRun = Boolean(enabled && complete && !isProd)

const client = (key: string) => createClient(url!, key, { auth: { persistSession: false, autoRefreshToken: false } })

async function signed(email: string, password: string) {
  const c = client(anonKey!)
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw error
  return c
}

describe('Stage 8.1 gates', () => {
  it('no apunta a producción y falla cerrado sin configuración', () => {
    expect(isProd).toBe(false)
    if (enabled) expect(complete).toBe(true)
  })
})

describe.skipIf(!canRun)('Stage 8.1 precios autoritativos', () => {
  let admin: SupabaseClient
  let other: SupabaseClient
  let service: SupabaseClient
  let productId = 0
  const createdVersionIds: string[] = []

  beforeAll(async () => {
    service = client(serviceKey!)
    admin = await signed(adminEmail!, adminPassword!)
    other = await signed(otherEmail!, otherPassword!)
    const { data, error } = await service.from('products').insert({
      name: `s81-price-${Date.now()}`,
      sale_price: 100000,
      discount_percentage: 0,
      stock: 5,
      min_stock: 1,
      visible_in_catalog: true,
    }).select('id').single()
    if (error) throw error
    productId = data.id
  })

  afterAll(async () => {
    if (productId) await service.from('products').delete().eq('id', productId)
    if (createdVersionIds.length) {
      await service.from('payment_pricing_versions').delete().in('id', createdVersionIds)
    }
  })

  it('calcula el 10% de transferencia en numeric', async () => {
    const { data, error } = await service.rpc('payment_transfer_price', {
      p_list: 100000,
      p_discount_rate: 0.10,
    })
    expect(error).toBeNull()
    expect(Number(data)).toBe(90000)
  })

  it('rechaza payload con precio manipulado', async () => {
    const { error } = await admin.rpc('payment_quote_totals', {
      p_payload: {
        lines: [{ line_type: 'product', product_id: productId, quantity: 1 }],
        total: 1,
      },
    })
    expect(error?.message || '').toMatch(/client_price_not_allowed/)
  })

  it('cotiza producto, cantidad y envío de forma autoritativa', async () => {
    const { data, error } = await admin.rpc('payment_quote_totals', {
      p_payload: {
        lines: [{ line_type: 'product', product_id: productId, quantity: 2 }],
        shipping_base: 8000,
        coupon_percent: 0,
      },
    })
    expect(error).toBeNull()
    const row = data as { total_base: number; total_public: number; transfer_saving: number }
    expect(Number(row.total_public)).toBe(208000)
    expect(Number(row.total_base)).toBe(188000)
    expect(Number(row.transfer_saving)).toBe(20000)
  })

  it('anon no lee versiones y el contexto público nace oculto', async () => {
    const anon = client(anonKey!)
    const table = await anon.from('payment_pricing_versions').select('id')
    expect(table.data ?? []).toEqual([])
    expect(table.error).toBeTruthy()
    const ctx = await anon.rpc('payment_public_pricing_context')
    expect(ctx.error).toBeNull()
    expect((ctx.data as { catalog_dual_price_visible: boolean }).catalog_dual_price_visible).toBe(false)
  })

  it('no-admin no ejecuta preview ni save', async () => {
    const preview = await other.rpc('payment_admin_preview_pricing')
    expect(preview.error).toBeTruthy()
    const draft = await other.rpc('payment_admin_save_draft', {
      p_payload: { transfer_discount_rate: 0.10 },
    })
    expect(draft.error).toBeTruthy()
  })

  it('admin puede previsualizar y guardar un draft con flags apagados', async () => {
    const preview = await admin.rpc('payment_admin_preview_pricing')
    expect(preview.error).toBeNull()
    const draft = await admin.rpc('payment_admin_save_draft', {
      p_payload: {
        transfer_discount_rate: 0.10,
        payments_enabled: false,
        catalog_dual_price_visible: false,
      },
    })
    expect(draft.error).toBeNull()
    const id = (draft.data as { id: string }).id
    createdVersionIds.push(id)
    expect((draft.data as { status: string; catalog_dual_price_visible: boolean }).status).toBe('draft')
    expect((draft.data as { catalog_dual_price_visible: boolean }).catalog_dual_price_visible).toBe(false)
  })
})
