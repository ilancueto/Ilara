/**
 * E2E Stage 9 — pedido, clienta, margen, devolución y navegación.
 * Solo Supabase local. Sin cobros reales.
 */
import { expect, test, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import {
  ensureE2EAdmin,
  getE2EEnv,
  requireE2E,
  seedCatalogProduct,
  cleanupProduct,
  serviceClient,
} from './helpers/fixtures'

const phone = '2995550188'

async function login(page: Page) {
  const { email, password } = getE2EEnv()
  await ensureE2EAdmin()
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  const emailInput = page.locator('#login-form-card input[type="email"]')
  const passwordInput = page.locator('#login-form-card input[type="password"]')
  await expect(emailInput).toBeVisible({ timeout: 15_000 })
  await emailInput.pressSequentially(email, { delay: 10 })
  await passwordInput.pressSequentially(password, { delay: 10 })
  await page.locator('#login-form-card form').evaluate((form) => (form as HTMLFormElement).requestSubmit())
  await expect(page).not.toHaveURL(/\/login/, { timeout: 25_000 })
}

test.describe('Stage 9 operación unificada', () => {
  let productId: number | null = null
  let orderId: string | null = null
  let orderNumber = ''
  let customerId: number | null = null
  let initialStock = 0
  const quoteIds: string[] = []

  test.beforeEach(() => requireE2E())

  test.beforeAll(async () => {
    if (!process.env.E2E_SUPABASE_URL) return
    requireE2E()
    await ensureE2EAdmin()
    const service = serviceClient()
    const product = await seedCatalogProduct()
    productId = product.id
    const stock = await service.from('products').select('stock').eq('id', product.id).single()
    initialStock = Number(stock.data?.stock || 0)

    const quote = await service.from('shipping_quotes').insert({
      quote_group_id: crypto.randomUUID(),
      provider: 'envia',
      destination_postal_code: '1000',
      destination_city: 'Buenos Aires',
      destination_state: 'CABA',
      destination_province_id: '02',
      destination_locality_id: '02000010',
      destination_street: 'Avenida Corrientes',
      destination_number: '1000',
      destination_formatted_address: 'Avenida Corrientes 1000',
      carrier: 'oca',
      carrier_description: 'OCA',
      service: 'standard',
      service_description: 'Entrega a domicilio',
      amount: 500,
      currency: 'ARS',
      request_ip_hash: 'e'.repeat(64),
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    }).select('id').single()
    if (quote.error || !quote.data) throw quote.error || new Error('quote')
    quoteIds.push(quote.data.id)

    const { url, anon } = getE2EEnv()
    const publicClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
    const idem = crypto.randomUUID()
    const created = await publicClient.rpc('create_catalog_order', {
      p_payload: {
        idempotency_key: idem,
        access_capability_hash: createHash('sha256').update(`plain-${idem}`).digest('hex'),
        shipping_quote_id: quote.data.id,
        customer_name: 'Clienta Stage9',
        customer_phone: phone,
        customer_email: 'stage9@example.test',
        lines: [{ line_type: 'product', product_id: productId, quantity: 1 }],
      },
    })
    if (created.error) throw created.error
    orderId = created.data.order_id
    orderNumber = created.data.order_number

    const { email, password } = getE2EEnv()
    const admin = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
    const auth = await admin.auth.signInWithPassword({ email, password })
    if (auth.error) throw auth.error
    const confirm = await admin.rpc('transition_catalog_order', {
      p_order_id: orderId,
      p_to_status: 'confirmed',
      p_reason: null,
    })
    if (confirm.error) throw confirm.error
    const order = await service.from('orders').select('customer_id').eq('id', orderId).single()
    customerId = order.data?.customer_id ?? null
  })

  test.afterAll(async () => {
    try {
      const service = serviceClient()
      if (orderId) {
        const { data: returns } = await service.from('order_returns').select('id').eq('order_id', orderId)
        const returnIds = (returns || []).map((r) => r.id)
        if (returnIds.length) {
          await service.from('order_return_items').delete().in('return_id', returnIds)
          await service.from('order_return_events').delete().in('return_id', returnIds)
          await service.from('order_returns').delete().in('id', returnIds)
        }
        await service.from('shipping_quotes').update({ order_id: null, consumed_at: null }).eq('order_id', orderId)
        await service.from('order_status_events').delete().eq('order_id', orderId)
        await service.from('order_items').delete().eq('order_id', orderId)
        await service.from('orders').delete().eq('id', orderId)
      }
      if (quoteIds.length) await service.from('shipping_quotes').delete().in('id', quoteIds)
      if (customerId) {
        await service.from('customer_notes').delete().eq('customer_id', customerId)
        await service.from('customers').delete().eq('id', customerId)
      }
    } catch {
      /* ignore */
    }
    if (productId) await cleanupProduct(productId)
  })

  test('pedido, clienta, margen, devolución y stock', async ({ page }) => {
    requireE2E()
    test.skip(!orderId || !productId, 'sin pedido seed')
    await login(page)

    await page.goto(`/?tab=orders&orderId=${orderId}`)
    await expect(page.getByTestId('pedidos-panel')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(orderNumber).first()).toBeVisible()
    await expect(page.getByTestId('pedido-detail')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('pedido-open-customer')).toBeVisible()

    if (customerId) {
      await page.getByTestId('pedido-open-customer').click()
      await expect(page.getByTestId('customer-crm-panel')).toBeVisible({ timeout: 20_000 })
      await expect(page.getByTestId('crm-catalog-orders')).toBeVisible()
      await expect(page.getByTestId(`crm-order-${orderNumber}`)).toBeVisible()
    }

    await page.goto('/?tab=margin_reports&channel=catalog')
    await expect(page.getByTestId('margin-report-panel')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('margin-channel-catalog')).toBeVisible()
    await expect(page.getByText('Margen catálogo')).toBeVisible()

    await page.goto(`/?tab=returns&channel=catalog&orderId=${orderId}`)
    await expect(page.getByTestId('devoluciones-panel')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('returns-channel-catalog')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('order-return-form')).toBeVisible({ timeout: 20_000 })
    const qty = page.locator('[data-testid^="order-return-qty-"]').first()
    await qty.fill('1')
    await page.getByTestId('order-return-reason').fill('Cambio solicitado por la clienta')
    await page.getByTestId('order-return-submit').click()
    await page.getByTestId('confirm-sale-return').getByRole('button', { name: /registrar/i }).click()
    await expect(page.getByText(/DEV-\d+/).first()).toBeVisible({ timeout: 20_000 })

    const service = serviceClient()
    const stock = await service.from('products').select('stock').eq('id', productId!).single()
    expect(Number(stock.data?.stock)).toBe(initialStock)

    await page.goto('/?tab=negocio')
    await expect(page.getByRole('button', { name: /Pedidos web/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Cuentas y caja/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Margen real/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Historial unificado/i })).toBeVisible()
  })
})
