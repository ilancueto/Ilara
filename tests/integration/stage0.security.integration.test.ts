/**
 * Integración Etapa 0 — requiere entorno Supabase local o staging.
 * Ver docs/ETAPA0_INTEGRATION_TESTS.md
 *
 * npm run test:integration  (con STAGE0_INTEGRATION=1)
 * Sin vars: un test de gate documenta el skip (no falla CI sin Docker).
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const enabled = process.env.STAGE0_INTEGRATION === '1'
const url = process.env.STAGE0_SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const anonKey = process.env.STAGE0_ANON_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
const serviceKey = process.env.STAGE0_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const userAEmail = process.env.STAGE0_USER_A_EMAIL?.trim()
const userAPassword = process.env.STAGE0_USER_A_PASSWORD?.trim()
const userBEmail = process.env.STAGE0_USER_B_EMAIL?.trim()
const userBPassword = process.env.STAGE0_USER_B_PASSWORD?.trim()

const canRunBase = Boolean(enabled && url && anonKey)
const canRunAuth = Boolean(canRunBase && userAEmail && userAPassword)
const canRunCrossUser = Boolean(canRunAuth && userBEmail && userBPassword && serviceKey)

function anonClient(): SupabaseClient {
  return createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } })
}

function serviceClient(): SupabaseClient {
  if (!serviceKey) throw new Error('STAGE0_SERVICE_ROLE_KEY requerido')
  return createClient(url!, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function signInClient(email: string, password: string): Promise<SupabaseClient> {
  const c = createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`signIn failed: ${error.message}`)
  return c
}

/** Error de privilegio (RLS/grants), no lista vacía. */
function expectPrivilegeError(error: { message?: string; code?: string } | null) {
  expect(error, 'se esperaba error de privilegios, no éxito vacío').toBeTruthy()
  const msg = (error?.message || '').toLowerCase()
  const code = String(error?.code || '')
  const looksDenied =
    code === '42501' ||
    code === 'PGRST301' ||
    /permission denied|not authorized|jwt|row-level security|rls|forbidden|access denied|privileg/i.test(
      msg
    )
  expect(looksDenied, `mensaje de error no parece de privilegios: ${code}`).toBe(true)
}

describe('Etapa 0 integración — gate de entorno', () => {
  it('documenta requisitos o exige vars cuando STAGE0_INTEGRATION=1', () => {
    if (!enabled) {
      expect(enabled).toBe(false)
      return
    }
    expect(url, 'STAGE0_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_URL').toBeTruthy()
    expect(anonKey, 'STAGE0_ANON_KEY o NEXT_PUBLIC_SUPABASE_ANON_KEY').toBeTruthy()
  })
})

describe.skipIf(!canRunBase)('Etapa 0 integración — anon y catálogo', () => {
  let anon: SupabaseClient

  beforeAll(() => {
    anon = anonClient()
  })

  it('anon no puede listar sales (error de privilegios obligatorio)', async () => {
    const { data, error } = await anon.from('sales').select('id').limit(5)
    expectPrivilegeError(error)
    expect(data == null || data.length === 0).toBe(true)
    const blob = `${error?.message || ''}${error?.code || ''}`
    expect(blob).not.toMatch(/customer_name|payment_breakdown|receipt_url/i)
  })

  it('anon no puede listar sale_items (error de privilegios obligatorio)', async () => {
    const { data, error } = await anon.from('sale_items').select('id, sale_id, quantity').limit(5)
    expectPrivilegeError(error)
    expect(data == null || data.length === 0).toBe(true)
  })

  it('anon no puede solicitar purchase_price de products', async () => {
    const { data, error } = await anon.from('products').select('id, purchase_price').limit(1)
    expect(error).toBeTruthy()
    expect(data == null || data.length === 0).toBe(true)
  })

  it('anon no puede solicitar notes ni min_stock', async () => {
    const notes = await anon.from('products').select('id, notes').limit(1)
    expect(notes.error).toBeTruthy()
    const minStock = await anon.from('products').select('id, min_stock').limit(1)
    expect(minStock.error).toBeTruthy()
  })

  it('anon puede leer columnas públicas de products', async () => {
    const { data, error } = await anon
      .from('products')
      .select('id, name, sale_price, stock, discount_percentage, catalog_badge, image_url')
      .limit(3)
    expect(error).toBeNull()
    if (data && data.length > 0) {
      expect(Object.keys(data[0])).not.toContain('purchase_price')
      expect(data[0]).toHaveProperty('name')
    }
  })

  it('anon puede ejecutar catalog_sales_by_product (solo agregados)', async () => {
    const { data, error } = await anon.rpc('catalog_sales_by_product')
    expect(error).toBeNull()
    if (data && data.length > 0) {
      const row = data[0] as Record<string, unknown>
      expect(row).toHaveProperty('product_id')
      expect(row).toHaveProperty('units_sold')
      expect(row).not.toHaveProperty('customer_name')
      expect(row).not.toHaveProperty('receipt_url')
    }
  })
})

describe.skipIf(!canRunAuth)('Etapa 0 integración — usuario permitido', () => {
  it('usuario autenticado permitido puede consultar sales sin error de privilegio', async () => {
    const user = await signInClient(userAEmail!, userAPassword!)
    const { error } = await user.from('sales').select('id').limit(1)
    expect(error).toBeNull()
    await user.auth.signOut()
  })
})

describe.skipIf(!canRunCrossUser)('Etapa 0 integración — Storage cross-user (no permitido)', () => {
  it('usuario B no obtiene signed URL del path de usuario A', async () => {
    const admin = serviceClient()
    const userA = await signInClient(userAEmail!, userAPassword!)
    const { data: aUser } = await userA.auth.getUser()
    const uidA = aUser.user?.id
    expect(uidA).toBeTruthy()

    const path = `${uidA}/stage0-integration-${Date.now()}.jpg`
    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    const { error: upErr } = await admin.storage
      .from('receipts')
      .upload(path, jpegHeader, { contentType: 'image/jpeg', upsert: true })
    expect(upErr).toBeNull()

    try {
      const userB = await signInClient(userBEmail!, userBPassword!)
      const { data: signed, error: signErr } = await userB.storage
        .from('receipts')
        .createSignedUrl(path, 60)
      const denied = Boolean(signErr) || !signed?.signedUrl
      expect(denied).toBe(true)

      const { data: listed, error: listErr } = await userB.storage.from('receipts').list(uidA!)
      expect(Boolean(listErr) || !listed || listed.length === 0).toBe(true)
      await userB.auth.signOut()
    } finally {
      await admin.storage.from('receipts').remove([path])
      await userA.auth.signOut()
    }
  })
})

describe.skipIf(!canRunBase)('Etapa 0 integración — Edge Function passkey 403', () => {
  it('passkey-auth responde 403 PASSKEYS_DISABLED en rutas de registro/login', async () => {
    const endpoints = ['/register/start', '/login/start', '/passkeys/list'] as const
    let sawDeployed = false
    for (const endpoint of endpoints) {
      const res = await fetch(`${url!.replace(/\/$/, '')}/functions/v1/passkey-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey!,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          endpoint,
          data: { email: 'probe@example.com', rpId: 'localhost', rpName: 'Ilara' },
        }),
      })
      if (res.status === 404) {
        expect.fail(
          'passkey-auth respondió 404 con STAGE0_INTEGRATION=1: la Edge Function debe estar desplegada'
        )
      }
      sawDeployed = true
      expect(res.status).toBe(403)
      const json = (await res.json()) as {
        success?: boolean
        error?: { code?: string; message?: string }
      }
      expect(json.success).toBe(false)
      expect(json.error?.code).toBe('PASSKEYS_DISABLED')
      expect(JSON.stringify(json)).not.toMatch(/tokenHash|public_key|service_role/i)
    }
    expect(sawDeployed, 'passkey-auth no se detectó desplegada bajo STAGE0_INTEGRATION=1').toBe(
      true
    )
  })
})
