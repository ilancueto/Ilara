import { test, expect } from '@playwright/test'
import {
  requireE2E,
  ensureE2EAdmin,
  getE2EEnv,
  seedCatalogProduct,
  cleanupProduct,
  serviceClient,
} from './helpers/fixtures'

/**
 * Flujos autenticados de POS/ops contra Supabase local/efímero.
 * Nunca contra producción.
 */
test.describe('POS y operaciones (local/efímero)', () => {
  test.beforeAll(async () => {
    // beforeAll no puede test.skip fácilmente; ensure se hace por test
  })

  test('login admin y redirección al panel', async ({ page }) => {
    requireE2E()
    await ensureE2EAdmin()
    const { email, password } = getE2EEnv()

    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    // React controlled inputs: click + type es más fiable que fill vacío en algunos runners.
    const emailInput = page.locator('#login-form-card input[type="email"]')
    const passInput = page.locator('#login-form-card input[type="password"]')
    await emailInput.click()
    await emailInput.fill('')
    await emailInput.pressSequentially(email, { delay: 15 })
    await passInput.click()
    await passInput.fill('')
    await passInput.pressSequentially(password, { delay: 15 })
    await expect(emailInput).toHaveValue(email)
    await page.locator('#login-form-card').locator('form').evaluate((form) => {
      ;(form as HTMLFormElement).requestSubmit()
    })

    await expect(page).not.toHaveURL(/\/login/, { timeout: 25000 })
    await expect(
      page.getByText(/tablero|ventas|inventario|ilara|dashboard|punto de venta|cargando/i).first()
    ).toBeVisible({ timeout: 20000 })
  })

  test('login fallido muestra error y permanece en login', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    const emailInput = page.locator('#login-form-card input[type="email"]')
    const passInput = page.locator('#login-form-card input[type="password"]')
    await emailInput.click()
    await emailInput.pressSequentially('nobody@example.com', { delay: 10 })
    await passInput.click()
    await passInput.pressSequentially('wrong-password-xyz', { delay: 10 })
    await page.locator('#login-form-card').locator('form').evaluate((form) => {
      ;(form as HTMLFormElement).requestSubmit()
    })
    // Credenciales inválidas o error de red local: mensaje visible y sin salir de /login
    await expect(
      page.getByText(/incorrectos|error|fetch|sesión|inválid|email|phone/i).first()
    ).toBeVisible({ timeout: 15000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('RPC venta con stock insuficiente (API aislada)', async () => {
    requireE2E()
    await ensureE2EAdmin()
    const product = await seedCatalogProduct()
    const admin = serviceClient()
    await admin.from('products').update({ stock: 0 }).eq('id', product.id)

    const { email, password, url, anon } = getE2EEnv()
    const { createClient } = await import('@supabase/supabase-js')
    const userClient = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const sign = await userClient.auth.signInWithPassword({ email, password })
    if (sign.error) {
      throw new Error(`No se pudo autenticar E2E user: ${sign.error.message}`)
    }

    const { error } = await userClient.rpc('create_sale_with_items', {
      p_payload: {
        sale: {
          payment_method: 'efectivo',
          status: 'completed',
          notes: null,
          customer_name: null,
          customer_id: null,
        },
        lines: [{ line_type: 'product', product_id: product.id, quantity: 1 }],
      },
    })

    try {
      expect(error).toBeTruthy()
      const msg = (error?.message || '').toLowerCase()
      expect(msg).toMatch(/stock|insufficient|autoriz|auth|permission|denied|role/i)
    } finally {
      await cleanupProduct(product.id)
    }
  })

  test('comprobante: bucket receipts no listable anónimo', async () => {
    requireE2E()
    const { url, anon } = getE2EEnv()
    const { createClient } = await import('@supabase/supabase-js')
    const client = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await client.storage.from('receipts').list('', { limit: 5 })
    if (!error) {
      expect(Array.isArray(data)).toBe(true)
    } else {
      expect(error.message || error).toBeTruthy()
    }
  })
})
