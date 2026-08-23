import { createHash, createHmac, randomUUID } from 'node:crypto'
import { chmod, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadEnvFile } from 'node:process'
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// Vercel supplies the release environment. The local file only fills secrets
// that belong exclusively to the linked Supabase functions (for example MP).
try {
  loadEnvFile('.env.local')
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}

const PROD_PROJECT_REF = 'qbbnvdmadgomfmrsfxlo'
const PROD_SITE_URL = 'https://ilara.com.ar'
const SAFE_EMAIL = 'delivered+ilara-release@resend.dev'
const STATE_PATH = join(tmpdir(), 'ilara-release-smoke-state.json')
const mode = process.argv[2] || 'prepare'

function required(name) {
  const value = process.env[name]?.trim() || ''
  if (!value) throw new Error(`missing_${name}`)
  return value
}

function assertProductionGate() {
  if (process.env.ALLOW_PRODUCTION_SMOKE !== '1') {
    throw new Error('set_ALLOW_PRODUCTION_SMOKE=1')
  }
  const url = required('NEXT_PUBLIC_SUPABASE_URL')
  const siteUrl = required('NEXT_PUBLIC_SITE_URL').replace(/\/$/, '')
  if (!url.includes(PROD_PROJECT_REF) || siteUrl !== PROD_SITE_URL) {
    throw new Error('unexpected_production_target')
  }
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

function clients() {
  const url = required('NEXT_PUBLIC_SUPABASE_URL')
  return {
    url,
    anon: createClient(url, required('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    service: createClient(url, required('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  }
}

async function saveState(state) {
  await writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
  await chmod(STATE_PATH, 0o600)
}

async function loadState() {
  return JSON.parse(await readFile(STATE_PATH, 'utf8'))
}

function expectOk(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message || JSON.stringify(result.error)}`)
  return result.data
}

async function signedWebhookSmoke(url) {
  const secret = required('MERCADOPAGO_WEBHOOK_SECRET')
  const dataId = '0'
  const requestId = `ilara-release-${randomUUID()}`
  const ts = String(Math.floor(Date.now() / 1000))
  const signature = createHmac('sha256', secret)
    .update(`id:${dataId};request-id:${requestId};ts:${ts};`)
    .digest('hex')
  const response = await fetch(
    `${url}/functions/v1/payments-mp-webhook?data.id=${dataId}&type=payment`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': requestId,
        'x-signature': `ts=${ts},v1=${signature}`,
      },
      body: JSON.stringify({ type: 'payment', data: { id: dataId } }),
    }
  )
  // A fake payment must reach Mercado Pago and fail there. 401 would mean that
  // our production signature secret does not match the deployed function.
  if (response.status !== 502) {
    throw new Error(`signed_webhook_unexpected_status_${response.status}`)
  }
  return response.status
}

async function cleanupState(state, quiet = false) {
  const { service } = clients()
  const errors = []
  const attempt = async (label, action) => {
    try {
      const result = await action()
      if (result?.error) throw result.error
    } catch (error) {
      errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (state.storagePath) {
    await attempt('storage', () => service.storage.from('payment-receipts').remove([state.storagePath]))
  }
  if (state.paymentId) {
    await attempt('payment_receipts', () => service.from('payment_receipts').delete().eq('payment_id', state.paymentId))
    await attempt('payment_events', () => service.from('payment_events').delete().eq('payment_id', state.paymentId))
    await attempt('payment_receipt_uploads', () => service.from('payment_receipt_uploads').delete().eq('payment_id', state.paymentId))
    await attempt('payment_access_tokens', () => service.from('payment_access_tokens').delete().eq('payment_id', state.paymentId))
    await attempt('order_payments', () => service.from('order_payments').delete().eq('id', state.paymentId))
  }
  if (state.orderId) {
    const itemRows = await service.from('order_items').select('id').eq('order_id', state.orderId)
    if (itemRows.error) errors.push(`select_order_items: ${itemRows.error.message}`)
    const itemIds = (itemRows.data || []).map((row) => row.id)
    if (itemIds.length) {
      await attempt('order_item_components', () =>
        service.from('order_item_components').delete().in('order_item_id', itemIds)
      )
    }
    for (const table of [
      'order_notification_links',
      'order_follow_sessions',
      'order_follow_tokens',
      'order_access_capabilities',
      'order_customer_link_audit',
      'order_status_events',
      'order_items',
    ]) {
      await attempt(table, () => service.from(table).delete().eq('order_id', state.orderId))
    }
    await attempt('orders', () => service.from('orders').delete().eq('id', state.orderId))
  }
  await rm(STATE_PATH, { force: true })
  if (errors.length) throw new Error(`cleanup_failed: ${errors.join(' | ')}`)
  if (!quiet) console.log('SMOKE_CLEANUP_OK')
}

async function recoverSmokeOrders() {
  assertProductionGate()
  const { service } = clients()
  const orders = expectOk(
    await service
      .from('orders')
      .select('id, order_number')
      .eq('customer_name', 'Smoke release Ilara')
      .limit(20),
    'find_smoke_orders'
  )
  for (const order of orders || []) {
    const payments = expectOk(
      await service.from('order_payments').select('id').eq('order_id', order.id),
      'find_smoke_payments'
    )
    const paymentId = payments?.[0]?.id
    let storagePath
    if (paymentId) {
      const receipt = expectOk(
        await service
          .from('payment_receipt_uploads')
          .select('storage_path')
          .eq('payment_id', paymentId)
          .maybeSingle(),
        'find_smoke_receipt'
      )
      storagePath = receipt?.storage_path
    }
    await cleanupState({ orderId: order.id, paymentId, storagePath }, true)
  }
  console.log(`SMOKE_RECOVERY_OK=${orders?.length || 0}`)
}

async function createOrderThroughProduction(state) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  try {
    await page.goto(`${PROD_SITE_URL}/catalogo`, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    const addButton = page.getByRole('button', { name: /agregar|añadir/i }).first()
    await addButton.waitFor({ state: 'visible', timeout: 45_000 })
    await addButton.click()
    const bagWithItem = page.getByRole('button', { name: /bolsa, [1-9]\d* ítems/i }).first()
    await bagWithItem.waitFor({ state: 'visible', timeout: 15_000 })
    await bagWithItem.click()
    const checkout = page.getByTestId('cart-checkout')
    await checkout.waitFor({ state: 'visible', timeout: 15_000 })
    await checkout.click()
    await page.getByTestId('checkout-pedido').waitFor({ state: 'visible' })
    await page.getByTestId('checkout-name').fill('Smoke release Ilara')
    await page.getByTestId('checkout-phone').fill(`299${String(Date.now()).slice(-7)}`)
    await page.getByTestId('checkout-email').fill(SAFE_EMAIL)
    await page.getByTestId('fulfillment-retiro').check()
    await page.getByTestId('checkout-submit').click()
    await page.getByTestId('checkout-success').waitFor({ state: 'visible', timeout: 45_000 })
    const orderNumber = (await page.getByTestId('order-number').textContent())?.trim() || ''
    if (!/^IL-\d{6,}$/.test(orderNumber)) throw new Error('invalid_browser_order_number')
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('ilara.pedidoSeguimiento')
      return raw ? JSON.parse(raw) : null
    })
    if (!stored?.access || stored.orderNumber !== orderNumber) {
      throw new Error('browser_order_access_not_persisted')
    }
    state.orderNumber = orderNumber
    state.capability = String(stored.access)
    const notifyText = (await page.getByTestId('checkout-notify').textContent()) || ''
    if (!notifyText.includes('Te enviamos por email')) throw new Error('production_email_not_sent')
    state.emailConfirmedByApp = true
  } finally {
    await browser.close()
  }
}

async function prepare() {
  assertProductionGate()
  const { url, anon, service } = clients()
  const state = { createdAt: new Date().toISOString() }
  try {
    const webhookStatus = await signedWebhookSmoke(url)
    const products = expectOk(
      await service
        .from('products')
        .select('id, name, stock')
        .gt('stock', 0)
        .or('visible_in_catalog.eq.true,visible_in_catalog.is.null')
        .order('id')
        .limit(1),
      'select_product'
    )
    const product = products?.[0]
    if (!product) throw new Error('no_in_stock_catalog_product')
    await createOrderThroughProduction(state)
    const order = expectOk(
      await service
        .from('orders')
        .select('id, total')
        .eq('order_number', state.orderNumber)
        .single(),
      'load_browser_order'
    )
    state.orderId = String(order.id)
    await saveState(state)

    const issued = expectOk(
      await service.rpc('create_order_notification_link', {
        p_order_number: state.orderNumber,
        p_kind: 'created',
      }),
      'create_notification_link'
    )
    const notificationToken = String(issued.token || '')
    if (notificationToken.length < 32) throw new Error('invalid_notification_token')
    state.notificationUrl = `${PROD_SITE_URL}/pedido/${encodeURIComponent(state.orderNumber)}?n=${encodeURIComponent(notificationToken)}`
    await saveState(state)

    const pricing = expectOk(
      await service
        .from('payment_pricing_versions')
        .select('id')
        .eq('status', 'active')
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle(),
      'select_active_pricing'
    )
    if (!pricing?.id) throw new Error('no_active_pricing')
    const amount = Number(order.total)
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('invalid_order_total')
    const payment = expectOk(
      await service
        .from('order_payments')
        .insert({
          order_id: state.orderId,
          pricing_version_id: pricing.id,
          idempotency_key: randomUUID(),
          method: 'bank_transfer',
          provider: 'manual',
          status: 'pending',
          base_amount: amount,
          public_amount: amount,
          transfer_saving: 0,
          amount_due: amount,
          external_reference: randomUUID(),
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single(),
      'create_smoke_payment'
    )
    state.paymentId = String(payment.id)
    await saveState(state)

    const prepared = expectOk(
      await service.rpc('prepare_transfer_receipt', {
        p_access_capability: state.capability,
        p_extension: 'png',
      }),
      'prepare_receipt'
    )
    state.storagePath = String(prepared.storage_path)
    await saveState(state)
    const signed = expectOk(
      await service.storage.from('payment-receipts').createSignedUploadUrl(state.storagePath),
      'sign_receipt_upload'
    )
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])
    expectOk(
      await anon.storage
        .from('payment-receipts')
        .uploadToSignedUrl(state.storagePath, signed.token, bytes, { contentType: 'image/png' }),
      'upload_signed_receipt'
    )
    expectOk(
      await service.rpc('complete_transfer_receipt', {
        p_access_capability: state.capability,
        p_storage_path: state.storagePath,
        p_mime_type: 'image/png',
        p_byte_size: bytes.length,
        p_sha256: sha256(bytes),
      }),
      'complete_receipt'
    )

    console.log('SMOKE_PREPARED')
    console.log(`ORDER_NUMBER=${state.orderNumber}`)
    console.log('PRODUCTION_EMAIL_CONFIRMED=true')
    console.log(`SIGNED_WEBHOOK_STATUS=${webhookStatus}`)
    console.log(`NOTIFICATION_URL=${state.notificationUrl}`)
  } catch (error) {
    await cleanupState(state, true).catch((cleanupError) => {
      console.error(cleanupError instanceof Error ? cleanupError.message : cleanupError)
    })
    throw error
  }
}

async function redeem() {
  assertProductionGate()
  const state = await loadState()
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  try {
    await page.goto(state.notificationUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await page.waitForURL(
      (current) =>
        current.origin === PROD_SITE_URL &&
        current.pathname === `/pedido/${state.orderNumber}` &&
        !current.searchParams.has('n'),
      { timeout: 45_000 }
    )
    await page.getByText(state.orderNumber, { exact: false }).first().waitFor({ state: 'visible', timeout: 30_000 })
    console.log('SMOKE_CROSS_DEVICE_OK')
    console.log(`CLEAN_URL=${page.url()}`)
  } finally {
    await browser.close()
  }
}

async function verify() {
  assertProductionGate()
  const state = await loadState()
  const { service } = clients()
  const order = expectOk(
    await service.from('orders').select('id, order_number, status').eq('id', state.orderId).single(),
    'verify_order'
  )
  const link = expectOk(
    await service
      .from('order_notification_links')
      .select('redeemed_at')
      .eq('order_id', state.orderId)
      .not('redeemed_at', 'is', null)
      .limit(1)
      .maybeSingle(),
    'verify_notification_link'
  )
  const sessions = expectOk(
    await service
      .from('order_follow_sessions')
      .select('id', { count: 'exact' })
      .eq('order_id', state.orderId),
    'verify_follow_session'
  )
  const receipt = expectOk(
    await service
      .from('payment_receipts')
      .select('storage_path, byte_size, mime_type')
      .eq('payment_id', state.paymentId)
      .single(),
    'verify_receipt'
  )
  if (!link?.redeemed_at || sessions.length < 1) throw new Error('cross_device_link_not_redeemed')
  if (receipt.storage_path !== state.storagePath || receipt.mime_type !== 'image/png') {
    throw new Error('receipt_verification_failed')
  }
  console.log('SMOKE_VERIFY_OK')
  console.log(`ORDER_NUMBER=${order.order_number}`)
  console.log(`ORDER_STATUS=${order.status}`)
  console.log(`FOLLOW_SESSIONS=${sessions.length}`)
  console.log(`RECEIPT_BYTES=${receipt.byte_size}`)
}

async function cleanup() {
  assertProductionGate()
  await cleanupState(await loadState())
}

if (!['prepare', 'redeem', 'verify', 'cleanup', 'recover'].includes(mode)) {
  throw new Error('usage: production-release-smoke.mjs prepare|redeem|verify|cleanup|recover')
}

await ({ prepare, redeem, verify, cleanup, recover: recoverSmokeOrders })[mode]()
