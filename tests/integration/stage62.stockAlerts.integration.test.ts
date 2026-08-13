/**
 * Integración Stage 6.2 — alertas de reposición.
 * STAGE62_INTEGRATION=1 (o STAGE61_INTEGRATION=1). Fail-closed. Bloquea prod.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const PROD_PROJECT_REFS = ['qbbnvdmadgomfmrsfxlo'] as const

const enabled =
  process.env.STAGE62_INTEGRATION === '1' ||
  process.env.STAGE61_INTEGRATION === '1'
const url =
  process.env.STAGE62_SUPABASE_URL?.trim() ||
  process.env.STAGE61_SUPABASE_URL?.trim() ||
  process.env.STAGE1_SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const anonKey =
  process.env.STAGE62_ANON_KEY?.trim() ||
  process.env.STAGE61_ANON_KEY?.trim() ||
  process.env.STAGE1_ANON_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
const serviceKey =
  process.env.STAGE62_SERVICE_ROLE_KEY?.trim() ||
  process.env.STAGE61_SERVICE_ROLE_KEY?.trim() ||
  process.env.STAGE1_SERVICE_ROLE_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const adminEmail =
  process.env.STAGE62_USER_A_EMAIL?.trim() ||
  process.env.STAGE61_USER_A_EMAIL?.trim() ||
  process.env.STAGE1_USER_A_EMAIL?.trim()
const adminPassword =
  process.env.STAGE62_USER_A_PASSWORD?.trim() ||
  process.env.STAGE61_USER_A_PASSWORD?.trim() ||
  process.env.STAGE1_USER_A_PASSWORD?.trim()
const otherEmail =
  process.env.STAGE62_USER_B_EMAIL?.trim() ||
  process.env.STAGE61_USER_B_EMAIL?.trim() ||
  process.env.STAGE1_USER_B_EMAIL?.trim()
const otherPassword =
  process.env.STAGE62_USER_B_PASSWORD?.trim() ||
  process.env.STAGE61_USER_B_PASSWORD?.trim() ||
  process.env.STAGE1_USER_B_PASSWORD?.trim()

function isProductionTarget(targetUrl: string | undefined): boolean {
  if (!targetUrl) return false
  return PROD_PROJECT_REFS.some((ref) => targetUrl.toLowerCase().includes(ref))
}

const isProd = isProductionTarget(url)

function requiredConfigComplete(): boolean {
  return Boolean(
    url && anonKey && serviceKey && adminEmail && adminPassword && otherEmail && otherPassword
  )
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
    throw new Error('expected privilege/RLS error')
  }
}

describe('Stage 6.2 gates', () => {
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

describe.skipIf(!canRun)('Stage 6.2 stock alerts integración', () => {
  let productId: number
  let productId2: number
  let adminId: string
  let otherId: string
  let adminRole: string | null
  let otherRole: string | null
  const productIds: number[] = []

  beforeAll(async () => {
    const admin = service()
    const a = await signIn(adminEmail!, adminPassword!)
    const b = await signIn(otherEmail!, otherPassword!)
    const au = (await a.auth.getUser()).data.user
    const bu = (await b.auth.getUser()).data.user
    if (!au?.id || !bu?.id) throw new Error('users missing')
    adminId = au.id
    otherId = bu.id

    const { data: ar } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', adminId)
      .maybeSingle()
    const { data: br } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', otherId)
      .maybeSingle()
    adminRole = ar?.role ?? null
    otherRole = br?.role ?? null

    await admin.from('user_roles').upsert({ user_id: adminId, role: 'admin', updated_by: adminId })
    await admin.from('user_roles').upsert({ user_id: otherId, role: 'none', updated_by: adminId })

    const { data: cat } = await admin
      .from('categories')
      .insert({ name: `s62-cat-${Date.now()}` })
      .select('id')
      .single()
    if (!cat) throw new Error('cat failed')

    const { data: p1, error: e1 } = await admin
      .from('products')
      .insert({
        name: `s62-low-${Date.now()}`,
        category_id: cat.id,
        sale_price: 1000,
        stock: 2,
        min_stock: 5,
        visible_in_catalog: true,
      })
      .select('id')
      .single()
    if (e1) throw e1
    productId = p1.id
    productIds.push(productId)

    const { data: p2, error: e2 } = await admin
      .from('products')
      .insert({
        name: `s62-ok-${Date.now()}`,
        category_id: cat.id,
        sale_price: 500,
        stock: 20,
        min_stock: 5,
        visible_in_catalog: true,
      })
      .select('id')
      .single()
    if (e2) throw e2
    productId2 = p2.id
    productIds.push(productId2)
  }, 60_000)

  afterAll(async () => {
    const admin = service()
    if (productIds.length) {
      const { data: alerts } = await admin
        .from('stock_alerts')
        .select('id')
        .in('product_id', productIds)
      const ids = (alerts || []).map((a) => a.id)
      if (ids.length) {
        await admin.from('stock_alert_events').delete().in('alert_id', ids)
        await admin.from('stock_alerts').delete().in('id', ids)
      }
      await admin.from('products').delete().in('id', productIds)
    }
    if (adminRole === null) await admin.from('user_roles').delete().eq('user_id', adminId)
    else
      await admin
        .from('user_roles')
        .upsert({ user_id: adminId, role: adminRole, updated_by: adminId })
    if (otherRole === null) await admin.from('user_roles').delete().eq('user_id', otherId)
    else
      await admin
        .from('user_roles')
        .upsert({ user_id: otherId, role: otherRole, updated_by: adminId })
  }, 60_000)

  it('anon no lee alertas ni eventos', async () => {
    const a = anon()
    const list = await a.from('stock_alerts').select('id').limit(1)
    expectDenied(list.error, list.data)
    const ev = await a.from('stock_alert_events').select('id').limit(1)
    expectDenied(ev.error, ev.data)
  })

  it('backfill/apertura automática y no duplicación', async () => {
    const admin = service()
    const { data: alerts, error } = await admin
      .from('stock_alerts')
      .select('id, status, suggested_qty, deficit, product_id')
      .eq('product_id', productId)
      .in('status', ['open', 'in_progress'])
    expect(error).toBeNull()
    expect(alerts?.length).toBe(1)
    expect(alerts![0].status).toBe('open')
    // stock 2, min 5 → target 10 → suggested 8; deficit 3
    expect(alerts![0].suggested_qty).toBe(8)
    expect(alerts![0].deficit).toBe(3)

    // second update still low → no second active
    await admin.from('products').update({ stock: 1 }).eq('id', productId)
    const { data: again } = await admin
      .from('stock_alerts')
      .select('id, stock_current')
      .eq('product_id', productId)
      .in('status', ['open', 'in_progress'])
    expect(again?.length).toBe(1)
    expect(again![0].stock_current).toBe(1)

    // product with stock ok has no active alert
    const { data: okAlerts } = await admin
      .from('stock_alerts')
      .select('id')
      .eq('product_id', productId2)
      .in('status', ['open', 'in_progress'])
    expect(okAlerts || []).toEqual([])
  })

  it('recuperación automática y reapertura en nuevo ciclo', async () => {
    const admin = service()
    const { data: active } = await admin
      .from('stock_alerts')
      .select('id')
      .eq('product_id', productId)
      .eq('status', 'open')
      .maybeSingle()
    expect(active?.id).toBeTruthy()
    const firstId = active!.id

    await admin.from('products').update({ stock: 20 }).eq('id', productId)
    const { data: closed } = await admin
      .from('stock_alerts')
      .select('id, status, resolution_kind')
      .eq('id', firstId)
      .single()
    expect(closed?.status).toBe('resolved')
    expect(closed?.resolution_kind).toBe('auto_stock')

    // new cycle
    await admin.from('products').update({ stock: 0 }).eq('id', productId)
    const { data: opened } = await admin
      .from('stock_alerts')
      .select('id, status')
      .eq('product_id', productId)
      .in('status', ['open', 'in_progress'])
    expect(opened?.length).toBe(1)
    expect(opened![0].id).not.toBe(firstId)

    // history of first cycle preserved
    const { data: events } = await admin
      .from('stock_alert_events')
      .select('to_status, reason')
      .eq('alert_id', firstId)
      .order('created_at', { ascending: true })
    expect((events || []).some((e) => e.reason === 'auto_stock_recovery')).toBe(true)
  })

  it('cambio de min_stock abre alerta', async () => {
    const admin = service()
    // productId2 stock 20 min 5 → raise min to 25
    await admin.from('products').update({ min_stock: 25 }).eq('id', productId2)
    const { data } = await admin
      .from('stock_alerts')
      .select('id, status, min_stock_current')
      .eq('product_id', productId2)
      .eq('status', 'open')
    expect(data?.length).toBe(1)
    expect(data![0].min_stock_current).toBe(25)
    // restore
    await admin.from('products').update({ min_stock: 5, stock: 20 }).eq('id', productId2)
  })

  it('actualizaciones concurrentes convergen en una sola alerta activa', async () => {
    const admin = service()
    const { data: p, error } = await admin
      .from('products')
      .insert({
        name: `s62-race-${Date.now()}`,
        sale_price: 100,
        stock: 20,
        min_stock: 5,
      })
      .select('id')
      .single()
    if (error) throw error
    const concurrentProductId = p.id as number
    productIds.push(concurrentProductId)

    const first = service()
    const second = service()
    const [r1, r2] = await Promise.all([
      first.from('products').update({ stock: 2 }).eq('id', concurrentProductId),
      second.from('products').update({ stock: 1 }).eq('id', concurrentProductId),
    ])
    expect(r1.error).toBeNull()
    expect(r2.error).toBeNull()

    const { data: active, error: activeError } = await admin
      .from('stock_alerts')
      .select('id, status, stock_current')
      .eq('product_id', concurrentProductId)
      .in('status', ['open', 'in_progress'])
    expect(activeError).toBeNull()
    expect(active).toHaveLength(1)
    expect([1, 2]).toContain(active![0].stock_current)
  })

  it('admin transition + none denied + idempotencia', async () => {
    const admin = service()
    // ensure active on productId
    await admin.from('products').update({ stock: 1, min_stock: 5 }).eq('id', productId)
    const { data: active } = await admin
      .from('stock_alerts')
      .select('id')
      .eq('product_id', productId)
      .in('status', ['open', 'in_progress'])
      .maybeSingle()
    const alertId = active!.id

    const noneUser = await signIn(otherEmail!, otherPassword!)
    const denied = await noneUser.rpc('transition_stock_alert', {
      p_alert_id: alertId,
      p_to_status: 'in_progress',
      p_note: null,
    })
    expect(denied.error?.message || '').toMatch(/not_authorized|permission/i)

    const listDenied = await noneUser.from('stock_alerts').select('id').limit(1)
    if (listDenied.error) {
      expect(listDenied.error).toBeTruthy()
    } else {
      expect(listDenied.data || []).toEqual([])
    }

    const adminClient = await signIn(adminEmail!, adminPassword!)
    const take = await adminClient.rpc('transition_stock_alert', {
      p_alert_id: alertId,
      p_to_status: 'in_progress',
      p_note: null,
    })
    expect(take.error).toBeNull()
    expect(take.data.status).toBe('in_progress')

    const take2 = await adminClient.rpc('transition_stock_alert', {
      p_alert_id: alertId,
      p_to_status: 'in_progress',
      p_note: null,
    })
    expect(take2.error).toBeNull()
    expect(take2.data.idempotent_replay).toBe(true)

    const bad = await adminClient.rpc('transition_stock_alert', {
      p_alert_id: alertId,
      p_to_status: 'dismissed',
      p_note: 'no',
    })
    expect(bad.error?.message || '').toMatch(/dismiss_note_required/)

    const dismiss = await adminClient.rpc('transition_stock_alert', {
      p_alert_id: alertId,
      p_to_status: 'dismissed',
      p_note: 'No reponer este lote',
    })
    expect(dismiss.error).toBeNull()
    expect(dismiss.data.status).toBe('dismissed')

    const { data: events } = await admin
      .from('stock_alert_events')
      .select('from_status, to_status, actor_kind')
      .eq('alert_id', alertId)
      .order('id', { ascending: true })
    expect((events || []).some((e) => e.to_status === 'in_progress' && e.actor_kind === 'admin')).toBe(
      true
    )
    expect((events || []).some((e) => e.to_status === 'dismissed')).toBe(true)
  })

  it('producto eliminado limpia alertas (cascade)', async () => {
    const admin = service()
    const { data: p } = await admin
      .from('products')
      .insert({
        name: `s62-del-${Date.now()}`,
        sale_price: 100,
        stock: 0,
        min_stock: 2,
      })
      .select('id')
      .single()
    const pid = p!.id
    productIds.push(pid)
    const { data: al } = await admin
      .from('stock_alerts')
      .select('id')
      .eq('product_id', pid)
      .eq('status', 'open')
    expect(al?.length).toBe(1)
    await admin.from('products').delete().eq('id', pid)
    productIds.pop()
    const { data: after } = await admin.from('stock_alerts').select('id').eq('product_id', pid)
    expect(after || []).toEqual([])
  })
})
