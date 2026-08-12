/**
 * Integración Etapa 1 — roles, frontera POS y precios.
 *
 * Habilitación EXPLÍCITA: STAGE1_INTEGRATION=1
 * Con STAGE1_INTEGRATION=1, faltan credenciales → FAIL (no pass silencioso).
 * Sin el flag → solo gates; remotos skipped.
 *
 * Bloquea proyecto productivo Ilara. No imprime PII ni tokens.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const PROD_PROJECT_REFS = ['qbbnvdmadgomfmrsfxlo'] as const

const enabled = process.env.STAGE1_INTEGRATION === '1'
const url = process.env.STAGE1_SUPABASE_URL?.trim() || process.env.STAGE0_SUPABASE_URL?.trim()
const anonKey =
  process.env.STAGE1_ANON_KEY?.trim() ||
  process.env.STAGE0_ANON_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
const serviceKey =
  process.env.STAGE1_SERVICE_ROLE_KEY?.trim() ||
  process.env.STAGE0_SERVICE_ROLE_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const userAEmail = process.env.STAGE1_USER_A_EMAIL?.trim() || process.env.STAGE0_USER_A_EMAIL?.trim()
const userAPassword =
  process.env.STAGE1_USER_A_PASSWORD?.trim() || process.env.STAGE0_USER_A_PASSWORD?.trim()
const userBEmail = process.env.STAGE1_USER_B_EMAIL?.trim() || process.env.STAGE0_USER_B_EMAIL?.trim()
const userBPassword =
  process.env.STAGE1_USER_B_PASSWORD?.trim() || process.env.STAGE0_USER_B_PASSWORD?.trim()

function isProductionTarget(targetUrl: string | undefined): boolean {
  if (!targetUrl) return false
  return PROD_PROJECT_REFS.some((ref) => targetUrl.toLowerCase().includes(ref))
}

const isProd = isProductionTarget(url)

/** Credenciales mínimas para mutaciones reales. */
function requiredConfigComplete(): boolean {
  return Boolean(url && anonKey && serviceKey && userAEmail && userAPassword && userBEmail && userBPassword)
}

const canRun = Boolean(enabled && requiredConfigComplete() && !isProd)
type TestRole = 'admin' | 'vendedor' | 'none'

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const c = createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`signIn failed: ${error.message}`)
  return c
}

function service(): SupabaseClient {
  return createClient(url!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function setRoleOrThrow(userId: string, role: 'admin' | 'vendedor' | 'none') {
  const { error } = await service().rpc('set_user_role', {
    p_user_id: userId,
    p_role: role,
  })
  if (error) throw new Error(`set_user_role(${role}) failed: ${error.message}`)
}

async function readRoleSnapshotOrThrow(userId: string): Promise<TestRole | null> {
  const { data, error } = await service()
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(`read role snapshot failed: ${error.message}`)
  return data ? (data.role as TestRole) : null
}

async function restoreRoleSnapshotOrThrow(userId: string, role: TestRole | null) {
  const admin = service()
  if (role === null) {
    const { error } = await admin.from('user_roles').delete().eq('user_id', userId)
    if (error) throw new Error(`restore missing role failed: ${error.message}`)
    return
  }

  const { error } = await admin.from('user_roles').upsert(
    { user_id: userId, role, updated_by: userId },
    { onConflict: 'user_id' }
  )
  if (error) throw new Error(`restore role ${role} failed: ${error.message}`)
}

function expectNoRowsOrDenied(
  data: unknown[] | null,
  error: { message?: string; code?: string } | null
) {
  if (error) {
    const msg = (error.message || '').toLowerCase()
    const code = String(error.code || '')
    const denied =
      code === '42501' ||
      code === 'PGRST301' ||
      /permission denied|row-level security|rls|not authorized|forbidden|access denied|privileg/i.test(
        msg
      )
    expect(denied, `error inesperado: ${code} ${error.message}`).toBe(true)
    return
  }
  expect(data == null || data.length === 0).toBe(true)
}

function expectMutationDenied(error: { message?: string; code?: string } | null) {
  expect(error, 'se esperaba denegación de mutación').toBeTruthy()
  const msg = (error!.message || '').toLowerCase()
  const code = String(error!.code || '')
  const denied =
    code === '42501' ||
    code === 'PGRST301' ||
    /permission denied|row-level security|rls|not authorized|forbidden|violates|privileg|policy|denied/i.test(
      msg
    )
  expect(denied, `no parece denegación: ${code} ${error!.message}`).toBe(true)
}

function expectRpcError(error: { message?: string } | null, pattern: RegExp) {
  expect(error, 'se esperaba error de RPC').toBeTruthy()
  expect(String(error!.message || '')).toMatch(pattern)
}

describe('Etapa 1 integración — gate (siempre corre)', () => {
  it('sin STAGE1_INTEGRATION=1 no ejecuta mutaciones', () => {
    if (!enabled) {
      expect(enabled).toBe(false)
      return
    }
    // Flag activo: configuración incompleta debe fallar aquí
    if (isProd) {
      expect.fail('STAGE1_INTEGRATION apuntó a producción Ilara — abortado')
    }
    if (!requiredConfigComplete()) {
      expect.fail(
        'STAGE1_INTEGRATION=1 requiere URL, anon, service_role, USER_A y USER_B (email+password). Config incompleta.'
      )
    }
    expect(canRun).toBe(true)
  })

  it('rechaza proyecto productivo', () => {
    if (!enabled) {
      expect(isProductionTarget(url)).toBe(false)
      return
    }
    expect(isProd).toBe(false)
  })

  it('STAGE0_INTEGRATION no habilita mutaciones Stage 1', () => {
    const stage0Only =
      process.env.STAGE0_INTEGRATION === '1' && process.env.STAGE1_INTEGRATION !== '1'
    if (stage0Only) expect(canRun).toBe(false)
    else expect(true).toBe(true)
  })
})

describe.skipIf(!canRun)('Etapa 1 integración — roles y frontera POS', () => {
  let adminClient: SupabaseClient
  let adminId: string
  let vendedorClient: SupabaseClient
  let vendedorId: string
  let originalAdminRole: TestRole | null = null
  let originalVendedorRole: TestRole | null = null
  let roleSnapshotsCaptured = false
  const createdSaleIds: number[] = []
  let productId: number
  let listPrice: number

  beforeAll(async () => {
    if (isProductionTarget(url)) {
      throw new Error('Refusing Stage1 integration against production')
    }

    adminClient = await signIn(userAEmail!, userAPassword!)
    const { data: au } = await adminClient.auth.getUser()
    adminId = au.user!.id

    vendedorClient = await signIn(userBEmail!, userBPassword!)
    const { data: bu } = await vendedorClient.auth.getUser()
    vendedorId = bu.user!.id
    if (adminId === vendedorId) {
      throw new Error('STAGE1_INTEGRATION requiere dos usuarios distintos')
    }

    const roleSnapshots = await Promise.all([
      readRoleSnapshotOrThrow(adminId),
      readRoleSnapshotOrThrow(vendedorId),
    ])
    originalAdminRole = roleSnapshots[0]
    originalVendedorRole = roleSnapshots[1]
    roleSnapshotsCaptured = true

    await setRoleOrThrow(adminId, 'admin')
    await setRoleOrThrow(vendedorId, 'vendedor')
    await vendedorClient.auth.signOut()
    vendedorClient = await signIn(userBEmail!, userBPassword!)

    const { data: products, error: pe } = await vendedorClient
      .from('products')
      .select('id, sale_price, stock')
      .gt('stock', 0)
      .limit(1)
    if (pe) throw new Error(`products select failed: ${pe.message}`)
    if (!products?.length) {
      throw new Error(
        'STAGE1_INTEGRATION: no hay productos con stock>0 en el entorno de prueba. Seed requerido.'
      )
    }
    const p = products[0] as { id: number; sale_price: number }
    productId = p.id
    listPrice = Math.round(Number(p.sale_price))
    if (listPrice <= 0) throw new Error('producto de prueba sin precio de lista válido')
  })

  afterAll(async () => {
    const errors: string[] = []
    if (adminClient) {
      for (const id of createdSaleIds) {
        const { error } = await adminClient.rpc('delete_sale_and_restore_stock', {
          p_sale_id: id,
        })
        if (error) errors.push(`cleanup sale ${id}: ${error.message}`)
      }
    }

    if (roleSnapshotsCaptured) {
      try {
        await restoreRoleSnapshotOrThrow(vendedorId, originalVendedorRole)
      } catch (e) {
        errors.push(`restore vendedor role: ${e instanceof Error ? e.message : String(e)}`)
      }
      try {
        await restoreRoleSnapshotOrThrow(adminId, originalAdminRole)
      } catch (e) {
        errors.push(`restore admin role: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    if (errors.length) {
      // No silenciar fallos de cleanup
      throw new Error(`cleanup errors: ${errors.join('; ')}`)
    }
  })

  it('user_roles: usuario lee propio; admin lee todos; none no ve ajenos', async () => {
    const { data: own, error: ownErr } = await vendedorClient
      .from('user_roles')
      .select('user_id, role')
      .eq('user_id', vendedorId)
    expect(ownErr).toBeNull()
    expect(own?.length).toBe(1)
    expect((own![0] as { role: string }).role).toBe('vendedor')

    const { data: others, error: oErr } = await vendedorClient
      .from('user_roles')
      .select('user_id')
      .eq('user_id', adminId)
    expectNoRowsOrDenied(others as unknown[] | null, oErr)

    const { data: all, error: aErr } = await adminClient.from('user_roles').select('user_id, role')
    expect(aErr).toBeNull()
    expect((all ?? []).length).toBeGreaterThanOrEqual(2)

    // none
    await setRoleOrThrow(vendedorId, 'none')
    try {
      const c = await signIn(userBEmail!, userBPassword!)
      const { data, error } = await c.from('user_roles').select('user_id, role')
      if (error) {
        expectMutationDenied(error)
      } else {
        // Solo puede ver su fila (role none) o vacío
        const rows = (data ?? []) as { user_id: string }[]
        for (const r of rows) expect(r.user_id).toBe(vendedorId)
      }
      await c.auth.signOut()
    } finally {
      await setRoleOrThrow(vendedorId, 'vendedor')
      vendedorClient = await signIn(userBEmail!, userBPassword!)
    }
  })

  it('vendedor crea venta vía RPC; precio manipulado se ignora', async () => {
    const { data, error } = await vendedorClient.rpc('create_sale_with_items', {
      p_payload: {
        sale: {
          payment_method: 'efectivo',
          status: 'completed',
          total: 1,
        },
        lines: [
          {
            line_type: 'product',
            product_id: productId,
            quantity: 1,
            unit_price: 1,
            subtotal: 1,
            product_name: 'HACK',
            discount_percentage: 99,
          },
        ],
      },
    })
    expect(error).toBeNull()
    const sale = (data as { sale?: { total?: number; id?: number }; lines?: Array<{ unit_price?: number; product_name?: string }> })
      ?.sale
    const lines = (data as { lines?: Array<{ unit_price?: number; product_name?: string }> })?.lines
    expect(sale?.total).toBe(listPrice)
    expect(sale?.id).toBeTruthy()
    expect(Number(lines?.[0]?.unit_price)).toBe(listPrice)
    expect(String(lines?.[0]?.product_name)).not.toBe('HACK')
    createdSaleIds.push(sale!.id!)
  })

  it('vendedor no puede INSERT/UPDATE/DELETE directos sales, sale_items, stock, products UPDATE', async () => {
    const salesIns = await vendedorClient.from('sales').insert({
      total: 1,
      payment_method: 'efectivo',
      status: 'completed',
    })
    expectMutationDenied(salesIns.error)

    const salesUpd = await vendedorClient
      .from('sales')
      .update({ total: 1 })
      .eq('id', createdSaleIds[0] ?? -1)
      .select('id')
    // UPDATE comparte grant de tabla con admin; RLS lo convierte en 0 filas.
    expectNoRowsOrDenied(salesUpd.data as unknown[] | null, salesUpd.error)

    const salesDel = await vendedorClient.from('sales').delete().eq('id', 1)
    expectMutationDenied(salesDel.error)

    const itemsIns = await vendedorClient.from('sale_items').insert({
      sale_id: 99999999,
      product_name: 'fake',
      quantity: 1,
      unit_price: 1,
      subtotal: 1,
    })
    expectMutationDenied(itemsIns.error)

    const itemsDel = await vendedorClient.from('sale_items').delete().eq('id', 1)
    expectMutationDenied(itemsDel.error)

    const sm = await vendedorClient.from('stock_movements').insert({
      product_id: productId,
      type: 'sale',
      quantity: -1,
      reference_type: 'sale',
      reference_id: 1,
    })
    if (!(sm.error && /relation|does not exist/i.test(sm.error.message || ''))) {
      expectMutationDenied(sm.error)
    }

    const { data: prod } = await vendedorClient
      .from('products')
      .select('id, stock')
      .eq('id', productId)
      .single()
    const stock = Number((prod as { stock: number }).stock)
    const pu = await vendedorClient
      .from('products')
      .update({ stock: stock + 50 })
      .eq('id', productId)
      .select('id')
    expectNoRowsOrDenied(pu.data as unknown[] | null, pu.error)
  })

  it('admin tampoco DELETE directo sales; solo RPC delete_sale_and_restore_stock', async () => {
    // Crear venta para intentar delete directo
    const { data, error } = await adminClient.rpc('create_sale_with_items', {
      p_payload: {
        sale: { payment_method: 'efectivo', status: 'completed' },
        lines: [{ line_type: 'product', product_id: productId, quantity: 1 }],
      },
    })
    expect(error).toBeNull()
    const saleId = (data as { sale?: { id?: number } })?.sale?.id
    expect(saleId).toBeTruthy()
    createdSaleIds.push(saleId!)

    const direct = await adminClient.from('sales').delete().eq('id', saleId!)
    expectMutationDenied(direct.error)

    // RPC sí funciona
    const { error: rpcErr } = await adminClient.rpc('delete_sale_and_restore_stock', {
      p_sale_id: saleId!,
    })
    expect(rpcErr).toBeNull()
    // quitar del cleanup
    const idx = createdSaleIds.indexOf(saleId!)
    if (idx >= 0) createdSaleIds.splice(idx, 1)
  })

  it('dos borrados concurrentes restauran stock exactamente una vez', async () => {
    const { data: before, error: beforeErr } = await adminClient
      .from('products')
      .select('stock')
      .eq('id', productId)
      .single()
    if (beforeErr) throw new Error(beforeErr.message)
    const stockBefore = Number((before as { stock: number }).stock)

    const { data, error } = await adminClient.rpc('create_sale_with_items', {
      p_payload: {
        sale: { payment_method: 'efectivo', status: 'completed' },
        lines: [{ line_type: 'product', product_id: productId, quantity: 1 }],
      },
    })
    expect(error).toBeNull()
    const saleId = (data as { sale?: { id?: number } })?.sale?.id
    expect(saleId).toBeTruthy()
    createdSaleIds.push(saleId!)

    const results = await Promise.all([
      adminClient.rpc('delete_sale_and_restore_stock', { p_sale_id: saleId! }),
      adminClient.rpc('delete_sale_and_restore_stock', { p_sale_id: saleId! }),
    ])
    const successes = results.filter((result) => !result.error)
    const failures = results.filter((result) => result.error)

    if (successes.length > 0) {
      const idx = createdSaleIds.indexOf(saleId!)
      if (idx >= 0) createdSaleIds.splice(idx, 1)
    }

    expect(successes).toHaveLength(1)
    expect(failures).toHaveLength(1)
    expect(String(failures[0]?.error?.message || '')).toMatch(/sale_not_found/i)

    const { data: after, error: afterErr } = await adminClient
      .from('products')
      .select('stock')
      .eq('id', productId)
      .single()
    if (afterErr) throw new Error(afterErr.message)
    expect(Number((after as { stock: number }).stock)).toBe(stockBefore)
  })

  it('breakdown malformado se rechaza (efectivo, crédito, pending, mixto)', async () => {
    const line = { line_type: 'product', product_id: productId, quantity: 1 }

    // presente como objeto
    expectRpcError(
      (
        await adminClient.rpc('create_sale_with_items', {
          p_payload: {
            sale: {
              payment_method: 'efectivo',
              status: 'completed',
              payment_breakdown: { method: 'efectivo', amount: listPrice },
            },
            lines: [line],
          },
        })
      ).error,
      /invalid_payment_breakdown/i
    )

    // string
    expectRpcError(
      (
        await adminClient.rpc('create_sale_with_items', {
          p_payload: {
            sale: {
              payment_method: 'efectivo',
              status: 'completed',
              payment_breakdown: 'efectivo',
            },
            lines: [line],
          },
        })
      ).error,
      /invalid_payment_breakdown/i
    )

    // clave presente como JSON null: no equivale a ausente
    expectRpcError(
      (
        await adminClient.rpc('create_sale_with_items', {
          p_payload: {
            sale: {
              payment_method: 'efectivo',
              status: 'completed',
              payment_breakdown: null,
            },
            lines: [line],
          },
        })
      ).error,
      /invalid_payment_breakdown/i
    )

    // método simple no admite un desglose contradictorio
    expectRpcError(
      (
        await adminClient.rpc('create_sale_with_items', {
          p_payload: {
            sale: {
              payment_method: 'efectivo',
              status: 'completed',
              payment_breakdown: [{ method: 'tarjeta', amount: listPrice }],
            },
            lines: [line],
          },
        })
      ).error,
      /payment_breakdown_not_allowed/i
    )

    // crédito pendiente representa deuda: no admite desglose ya cobrado
    expectRpcError(
      (
        await adminClient.rpc('create_sale_with_items', {
          p_payload: {
            sale: {
              payment_method: 'credito',
              status: 'pending_payment',
              payment_breakdown: [{ method: 'efectivo', amount: listPrice }],
            },
            lines: [line],
          },
        })
      ).error,
      /payment_breakdown_not_allowed/i
    )

    // crédito con breakdown inválido (monto negativo)
    expectRpcError(
      (
        await adminClient.rpc('create_sale_with_items', {
          p_payload: {
            sale: {
              payment_method: 'credito',
              status: 'pending_payment',
              payment_breakdown: [{ method: 'efectivo', amount: -1 }],
            },
            lines: [line],
          },
        })
      ).error,
      /invalid_payment_breakdown/i
    )

    // mixto sin desglose
    expectRpcError(
      (
        await adminClient.rpc('create_sale_with_items', {
          p_payload: {
            sale: { payment_method: 'mixto', status: 'completed' },
            lines: [line],
          },
        })
      ).error,
      /payment_breakdown_required/i
    )

    // mixto suma incorrecta
    expectRpcError(
      (
        await adminClient.rpc('create_sale_with_items', {
          p_payload: {
            sale: {
              payment_method: 'mixto',
              status: 'completed',
              payment_breakdown: [{ method: 'efectivo', amount: 1 }],
            },
            lines: [line],
          },
        })
      ).error,
      /payment_mismatch/i
    )

    // pending_payment con método no credito
    expectRpcError(
      (
        await adminClient.rpc('create_sale_with_items', {
          p_payload: {
            sale: { payment_method: 'efectivo', status: 'pending_payment' },
            lines: [line],
          },
        })
      ).error,
      /payment_status_mismatch/i
    )
  })

  it('último admin protegido (serializado; no dejar cero admins)', async () => {
    const { data: admins, error } = await service()
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
    if (error) throw new Error(error.message)
    const list = (admins ?? []) as { user_id: string }[]
    const others = list.filter((a) => a.user_id !== adminId)

    // Deja solo adminId como admin para el assert; restaura en finally.
    for (const o of others) {
      await setRoleOrThrow(o.user_id, 'vendedor')
    }
    try {
      const { error: demoteErr } = await adminClient.rpc('set_user_role', {
        p_user_id: adminId,
        p_role: 'vendedor',
      })
      expectRpcError(demoteErr, /last_admin/i)

      // Confirmación: sigue habiendo exactamente un admin
      const { data: after, error: aErr } = await service()
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')
      if (aErr) throw new Error(aErr.message)
      expect((after ?? []).length).toBe(1)
      expect((after![0] as { user_id: string }).user_id).toBe(adminId)
    } finally {
      for (const o of others) {
        await setRoleOrThrow(o.user_id, 'admin')
      }
    }
  })

  it('bootstrap_first_admin no invocable por authenticated', async () => {
    const { error } = await adminClient.rpc('bootstrap_first_admin', {
      p_user_id: adminId,
    })
    expect(error).toBeTruthy()
  })

  it('passkeys contenidas: 403 PASSKEYS_DISABLED (no acepta 404 como éxito)', async () => {
    const res = await fetch(`${url!.replace(/\/$/, '')}/functions/v1/passkey-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey!,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ endpoint: '/register/start', data: {} }),
    })
    expect(res.status).toBe(403)
    const body = (await res.json().catch(() => null)) as {
      error?: { code?: string }
      code?: string
    } | null
    const code = body?.error?.code || body?.code || ''
    expect(String(code)).toMatch(/PASSKEYS_DISABLED/i)
  })

  it('helpers internos de passkeys no son RPC para anon ni authenticated', async () => {
    const anon = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const anonAttempt = await anon.rpc('cleanup_expired_passkey_challenges')
    expectMutationDenied(anonAttempt.error)

    const authenticatedAttempt = await adminClient.rpc('cleanup_expired_passkey_challenges')
    expectMutationDenied(authenticatedAttempt.error)
  })
})
