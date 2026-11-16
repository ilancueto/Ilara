import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isAllowedTestSupabaseUrl } from '@/lib/security/testSupabaseTarget.mjs'

const enabled = process.env.SECURE_PUBLIC_FLOWS_INTEGRATION === '1'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const canRun = Boolean(enabled && url && isAllowedTestSupabaseUrl(url) && anonKey && serviceKey)

const client = () => `test-client-${crypto.randomUUID()}`

describe.skipIf(!canRun)('código ILARA y búsqueda "Seguir mi pedido"', () => {
  let service: SupabaseClient
  let anon: SupabaseClient
  let orderId = ''
  let orderNumber = ''

  beforeAll(async () => {
    service = createClient(url!, serviceKey!, { auth: { persistSession: false } })
    anon = createClient(url!, anonKey!, { auth: { persistSession: false } })
    const code = await service.rpc('next_catalog_order_number')
    if (code.error) throw code.error
    orderNumber = String(code.data)
    const order = await service.from('orders').insert({
      order_number: orderNumber,
      status: 'pending',
      channel: 'catalog',
      idempotency_key: `lookup-${crypto.randomUUID()}`,
      request_fingerprint: '0'.repeat(32),
      customer_name: 'Lookup Test',
      customer_phone: '+54 9 299 555-7711',
      subtotal: 1000,
      discount_total: 0,
      shipping_amount: 0,
      total: 1000,
      stock_reserved: false,
    }).select('id').single()
    if (order.error) throw order.error
    orderId = order.data.id
  })

  afterAll(async () => {
    if (orderId) await service.from('orders').delete().eq('id', orderId)
    await service.from('order_lookup_attempts').delete().like('client_hash', 'test-client-%')
  })

  it('genera códigos ILARA- de 6 caracteres sin símbolos ambiguos', async () => {
    expect(orderNumber).toMatch(/^ILARA-[2-9A-HJKMNP-Z]{6}$/)
    const codes = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const next = await service.rpc('next_catalog_order_number')
      expect(next.error).toBeNull()
      codes.add(String(next.data))
    }
    expect(codes.size).toBe(20)
  })

  it('acepta número + teléfono aunque el formato del teléfono cambie', async () => {
    const ok = await service.rpc('verify_order_lookup', {
      p_order_number: orderNumber.toLowerCase(),
      p_phone: '299 555 7711',
      p_client_hash: client(),
    })
    expect(ok.error).toBeNull()
    expect(ok.data).toEqual({ ok: true, order_number: orderNumber })
  })

  it('responde igual si el teléfono no coincide o el pedido no existe', async () => {
    const wrongPhone = await service.rpc('verify_order_lookup', {
      p_order_number: orderNumber,
      p_phone: '2995550000',
      p_client_hash: client(),
    })
    const missing = await service.rpc('verify_order_lookup', {
      p_order_number: 'ILARA-ZZZZZZ',
      p_phone: '2995557711',
      p_client_hash: client(),
    })
    expect(wrongPhone.data).toEqual({ ok: false, reason: 'not_found' })
    expect(missing.data).toEqual({ ok: false, reason: 'not_found' })
  })

  it('limita los intentos por cliente', async () => {
    const same = client()
    let last: unknown = null
    for (let i = 0; i < 11; i++) {
      const r = await service.rpc('verify_order_lookup', {
        p_order_number: 'ILARA-ZZZZZZ',
        p_phone: '2995550000',
        p_client_hash: same,
      })
      last = r.data
    }
    expect(last).toEqual({ ok: false, reason: 'rate_limited' })
  })

  it('anon no puede usar la búsqueda ni leer los intentos', async () => {
    const rpc = await anon.rpc('verify_order_lookup', {
      p_order_number: orderNumber,
      p_phone: '2995557711',
      p_client_hash: client(),
    })
    expect(rpc.error).not.toBeNull()
    const read = await anon.from('order_lookup_attempts').select('id').limit(1)
    expect(read.data ?? []).toEqual([])
  })

  it('el link de notificación acepta el formato nuevo', async () => {
    const link = await service.rpc('create_order_notification_link', { p_order_number: orderNumber, p_kind: 'lookup_test' })
    expect(link.error).toBeNull()
    expect(String((link.data as { token?: string }).token || '')).toHaveLength(64)
  })
})
