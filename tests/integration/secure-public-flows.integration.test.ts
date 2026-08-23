import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const enabled = process.env.SECURE_PUBLIC_FLOWS_INTEGRATION === '1'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const isLocal = Boolean(url && /^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(url))
const canRun = Boolean(enabled && isLocal && anonKey && serviceKey)
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const hashBytes = (value: Uint8Array) => createHash('sha256').update(value).digest('hex')

describe.skipIf(!canRun)('uploads firmados y enlaces de notificación', () => {
  let service: SupabaseClient
  let anon: SupabaseClient
  let orderId = ''
  let paymentId = ''
  let pricingId = ''
  const paths: string[] = []
  const capability = `receipt-${crypto.randomUUID()}-${crypto.randomUUID()}`
  const orderNumber = `IL-${Date.now()}`

  beforeAll(async () => {
    service = createClient(url!, serviceKey!, { auth: { persistSession: false } })
    anon = createClient(url!, anonKey!, { auth: { persistSession: false } })
    const latest = await service.from('payment_pricing_versions').select('version_number').order('version_number', { ascending: false }).limit(1)
    const pricing = await service.from('payment_pricing_versions').insert({
      version_number: Number(latest.data?.[0]?.version_number || 0) + 1,
      status: 'draft',
      effective_fee_rate: 0,
      rounding_increment: 1,
    }).select('id').single()
    if (pricing.error) throw pricing.error
    pricingId = pricing.data.id
    const order = await service.from('orders').insert({
      order_number: orderNumber,
      status: 'pending',
      channel: 'catalog',
      idempotency_key: crypto.randomUUID(),
      request_fingerprint: 'f'.repeat(32),
      customer_name: 'Prueba segura',
      customer_phone: '2995558800',
      subtotal: 100,
      discount_total: 0,
      shipping_amount: 0,
      total: 100,
      stock_reserved: false,
    }).select('id').single()
    if (order.error) throw order.error
    orderId = order.data.id
    const access = await service.from('order_access_capabilities').insert({
      order_id: orderId,
      capability_hash: hash(capability),
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    })
    if (access.error) throw access.error
    const payment = await service.from('order_payments').insert({
      order_id: orderId,
      pricing_version_id: pricingId,
      idempotency_key: crypto.randomUUID(),
      method: 'bank_transfer',
      provider: 'manual',
      status: 'pending',
      base_amount: 100,
      public_amount: 100,
      transfer_saving: 0,
      amount_due: 100,
      external_reference: crypto.randomUUID(),
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    }).select('id').single()
    if (payment.error) throw payment.error
    paymentId = payment.data.id
  })

  afterAll(async () => {
    if (paths.length) await service.storage.from('payment-receipts').remove(paths)
    if (paymentId) {
      await service.from('payment_receipts').delete().eq('payment_id', paymentId)
      await service.from('payment_events').delete().eq('payment_id', paymentId)
      await service.from('payment_receipt_uploads').delete().eq('payment_id', paymentId)
      await service.from('order_payments').delete().eq('id', paymentId)
    }
    if (orderId) {
      await service.from('order_access_capabilities').delete().eq('order_id', orderId)
      await service.from('orders').delete().eq('id', orderId)
    }
    if (pricingId) await service.from('payment_pricing_versions').delete().eq('id', pricingId)
  })

  it('sube con firma sin exponer permisos de Storage y consume la reserva una sola vez', async () => {
    const denied = await anon.rpc('prepare_transfer_receipt', {
      p_access_capability: capability,
      p_extension: 'png',
    })
    expect(denied.error).toBeTruthy()
    const prepared = await service.rpc('prepare_transfer_receipt', {
      p_access_capability: capability,
      p_extension: 'png',
    })
    expect(prepared.error).toBeNull()
    const row = prepared.data as { storage_path: string; expected_mime: string }
    paths.push(row.storage_path)
    expect(row.expected_mime).toBe('image/png')
    const deniedComplete = await anon.rpc('complete_transfer_receipt', {
      p_access_capability: capability,
      p_storage_path: row.storage_path,
      p_mime_type: 'image/png',
      p_byte_size: 9,
      p_sha256: 'a'.repeat(64),
    })
    expect(deniedComplete.error).toBeTruthy()
    const signed = await service.storage.from('payment-receipts').createSignedUploadUrl(row.storage_path)
    expect(signed.error).toBeNull()
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])
    const upload = await anon.storage.from('payment-receipts').uploadToSignedUrl(
      row.storage_path,
      signed.data!.token,
      bytes,
      { contentType: 'image/png' }
    )
    expect(upload.error).toBeNull()
    const completed = await service.rpc('complete_transfer_receipt', {
      p_access_capability: capability,
      p_storage_path: row.storage_path,
      p_mime_type: 'image/png',
      p_byte_size: bytes.length,
      p_sha256: hashBytes(bytes),
    })
    expect(completed.error).toBeNull()
    const replay = await service.rpc('complete_transfer_receipt', {
      p_access_capability: capability,
      p_storage_path: row.storage_path,
      p_mime_type: 'image/png',
      p_byte_size: bytes.length,
      p_sha256: hashBytes(bytes),
    })
    expect(replay.error?.message || '').toMatch(/invalid_receipt_upload/)
  })

  it('guarda solo hashes, canjea el enlace una vez y abre una sesión cross-device', async () => {
    const denied = await anon.rpc('create_order_notification_link', {
      p_order_number: orderNumber,
      p_kind: 'created',
    })
    expect(denied.error).toBeTruthy()
    const issued = await service.rpc('create_order_notification_link', {
      p_order_number: orderNumber,
      p_kind: 'created',
    })
    expect(issued.error).toBeNull()
    const token = String((issued.data as { token: string }).token)
    const persisted = await service.from('order_notification_links').select('token_hash').eq('order_id', orderId).single()
    expect(persisted.data?.token_hash).toBe(hash(token))
    expect(persisted.data?.token_hash).not.toContain(token)
    const redeemed = await service.rpc('redeem_order_notification_link', {
      p_order_number: orderNumber,
      p_plain: token,
    })
    expect(redeemed.error).toBeNull()
    const session = String((redeemed.data as { follow_token: string }).follow_token)
    const follow = await anon.rpc('get_catalog_order_follow', {
      p_order_number: orderNumber,
      p_follow_token: session,
    })
    expect(follow.error).toBeNull()
    expect((follow.data as { order_number: string }).order_number).toBe(orderNumber)
    const replay = await service.rpc('redeem_order_notification_link', {
      p_order_number: orderNumber,
      p_plain: token,
    })
    expect(replay.error?.message || '').toMatch(/invalid_notification_link/)
  })
})
