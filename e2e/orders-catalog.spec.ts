/**
 * E2E Stage 6.1 — checkout de catálogo y panel de pedidos.
 * Solo Supabase local (E2E_* loopback). Sin mutaciones a producción.
 */
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {
  requireE2E,
  ensureE2EAdmin,
  getE2EEnv,
  serviceClient,
  seedCatalogProduct,
  cleanupProduct,
} from './helpers/fixtures'

test.describe('Stage 6.1 pedidos catálogo', () => {
  test.beforeEach(() => {
    requireE2E()
  })

  let productId: number | null = null
  let productName = ''
  let ownsProduct = false

  test.beforeAll(async () => {
    if (!process.env.E2E_SUPABASE_URL) return
    requireE2E()
    const prebuiltProductId = Number(process.env.E2E_CATALOG_PRODUCT_ID || '')
    const prebuiltProductName = (process.env.E2E_CATALOG_PRODUCT_NAME || '').trim()
    if (Number.isSafeInteger(prebuiltProductId) && prebuiltProductId > 0 && prebuiltProductName) {
      productId = prebuiltProductId
      productName = prebuiltProductName
      return
    }
    const p = await seedCatalogProduct()
    productId = p.id
    productName = p.name
    ownsProduct = true
  })

  test.afterAll(async () => {
    try {
      const admin = serviceClient()
      // Pedidos del teléfono E2E + cualquier línea que referencie el producto seed.
      const { data: byPhone } = await admin
        .from('orders')
        .select('id')
        .eq('customer_phone', '2995550199')
      let ids = (byPhone || []).map((r) => r.id as string)
      if (productId) {
        const { data: byProd } = await admin
          .from('order_items')
          .select('order_id')
          .eq('product_id', productId)
        ids = Array.from(new Set([...ids, ...((byProd || []).map((r) => r.order_id as string))]))
      }
      if (ids.length) {
        await admin.from('order_status_events').delete().in('order_id', ids)
        await admin.from('order_items').delete().in('order_id', ids)
        await admin.from('orders').delete().in('id', ids)
      }
    } catch {
      /* ignore cleanup errors */
    }
    // El producto prebuild de CI debe sobrevivir reintentos en workers nuevos.
    // Supabase es efímero y se descarta al terminar el job.
    if (productId && ownsProduct) await cleanupProduct(productId)
  })

  test('crear pedido desde catálogo y verlo en panel', async ({ page }) => {
    requireE2E()
    test.skip(!productId, 'sin producto seed')

    await page.goto('/catalogo')
    await page.waitForLoadState('networkidle')

    const search = page.locator('input[type="search"], input[placeholder*="Busc"]').first()
    if (await search.count()) {
      await search.fill(productName)
      await page.waitForTimeout(500)
    }

    // Seleccionar la card exacta: otras suites crean productos E2E en paralelo.
    const productLink = page.getByRole('link', { name: productName, exact: true })
    await expect(productLink).toBeVisible({ timeout: 10_000 })
    const productCard = page.locator('article').filter({ has: productLink })
    const addProduct = productCard.getByRole('button', { name: /agregar|añadir/i })
    await addProduct.click()

    const bag = page.getByRole('button', { name: /bolsa/i }).first()
    await expect(bag).toBeVisible({ timeout: 10_000 })
    const checkout = page.getByTestId('cart-checkout')
    // Algunas variantes abren la bolsa al agregar; no hacer clic detrás del backdrop.
    if (!(await checkout.isVisible().catch(() => false))) {
      await bag.click()
    }
    await expect(checkout).toBeVisible({ timeout: 10_000 })
    await checkout.click()
    await expect(page.getByTestId('checkout-pedido')).toBeVisible()

    await page.getByTestId('checkout-name').fill('Cliente E2E')
    await page.getByTestId('checkout-phone').fill('2995550199')
    await page.getByTestId('checkout-submit').click()

    await expect(page.getByTestId('checkout-success')).toBeVisible({ timeout: 25_000 })
    const orderNumber = (await page.getByTestId('order-number').textContent())?.trim() || ''
    expect(orderNumber).toMatch(/^IL-\d{6}$/)
    await expect(page.getByTestId('checkout-submit')).toHaveCount(0)

    // Axe acotado al drawer de checkout (contraste residual del catálogo legacy está fuera de 6.1).
    const axe = await new AxeBuilder({ page })
      .include('[data-testid="checkout-pedido"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    const serious = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([])

    // Regresión: cerrar una confirmación debe desmontar el checkout y permitir un pedido nuevo.
    await page.getByRole('button', { name: /seguir mirando el catálogo/i }).click()
    await expect(page.getByTestId('checkout-pedido')).toHaveCount(0)
    await addProduct.click()
    if (!(await page.getByTestId('cart-checkout').isVisible().catch(() => false))) {
      await bag.click()
    }
    await expect(page.getByTestId('cart-checkout')).toBeVisible()
    await page.getByTestId('cart-checkout').click()
    await expect(page.getByTestId('checkout-submit')).toBeVisible()
    await expect(page.getByTestId('checkout-success')).toHaveCount(0)
    await page.getByRole('button', { name: /cerrar checkout/i }).click()

    const { email, password } = await ensureE2EAdmin()
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    const emailInput = page.locator('#login-form-card input[type="email"]')
    const passInput = page.locator('#login-form-card input[type="password"]')
    await emailInput.fill('')
    await emailInput.pressSequentially(email, { delay: 10 })
    await passInput.fill('')
    await passInput.pressSequentially(password, { delay: 10 })
    await page.locator('#login-form-card form').evaluate((form) => {
      ;(form as HTMLFormElement).requestSubmit()
    })
    await expect(page).not.toHaveURL(/\/login/, { timeout: 25_000 })

    await page.goto('/?tab=orders')
    await expect(page.getByTestId('pedidos-panel')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('pedidos-search').fill(orderNumber)
    await page.waitForTimeout(600)
    await page.getByTestId(`pedido-row-${orderNumber}`).click()
    await expect(page.getByTestId('pedido-detail')).toBeVisible()

    await page.getByTestId('pedido-transition-confirmed').click()
    await page.getByTestId('confirm-pedido-confirm').click()
    await expect(
      page.getByTestId('pedido-detail').getByText('Confirmado', { exact: true })
    ).toBeVisible({ timeout: 15_000 })

    // sanity env local
    expect(getE2EEnv().url).toMatch(/127\.0\.0\.1|localhost/)
  })
})
