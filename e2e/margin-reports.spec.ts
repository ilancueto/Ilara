import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { createClient } from '@supabase/supabase-js'
import { ensureE2EAdmin, getE2EEnv, requireE2E, serviceClient } from './helpers/fixtures'

async function login(page: Page) {
  const { email, password } = getE2EEnv()
  await ensureE2EAdmin()
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#login-form-card input[type="email"]').pressSequentially(email, { delay: 10 })
  await page.locator('#login-form-card input[type="password"]').pressSequentially(password, { delay: 10 })
  await page.locator('#login-form-card form').evaluate((form) => (form as HTMLFormElement).requestSubmit())
  await expect(page).not.toHaveURL(/\/login/, { timeout: 25_000 })
}

test.describe('Stage 6.4 margen real', () => {
  let productId: number | null = null
  let saleId: number | null = null
  let itemId: number | null = null
  let apiUserId: string | null = null
  test.beforeEach(() => requireE2E())
  test.afterAll(async () => {
    const service = serviceClient()
    if (itemId) await service.from('sale_item_components').delete().eq('sale_item_id', itemId)
    if (saleId) {
      await service.from('stock_movements').delete().eq('reference_type', 'sale').eq('reference_id', saleId)
      await service.from('sale_items').delete().eq('sale_id', saleId)
      await service.from('sales').delete().eq('id', saleId)
    }
    if (productId) await service.from('products').delete().eq('id', productId)
    if (apiUserId) await service.auth.admin.deleteUser(apiUserId)
  })

  test('muestra margen histórico y pasa accesibilidad crítica', async ({ page }) => {
    const { url, anon, password } = getE2EEnv()
    await ensureE2EAdmin()
    const service = serviceClient()
    const category = await service.from('categories').select('id').limit(1).single()
    if (category.error) throw category.error
    const name = `E2E Margin ${Date.now()}`
    const product = await service.from('products').insert({ name, category_id: category.data.id, sale_price: 1000, purchase_price: 400, stock: 10, min_stock: 1, visible_in_catalog: false }).select('id').single()
    if (product.error) throw product.error
    productId = product.data.id
    const apiEmail = 'e2e-margin-api@example.com'
    const users = await service.auth.admin.listUsers({ page: 1, perPage: 200 })
    let apiUser = users.data?.users.find((user) => user.email === apiEmail)
    if (!apiUser) {
      const createdUser = await service.auth.admin.createUser({ email: apiEmail, password, email_confirm: true })
      if (createdUser.error) throw createdUser.error
      apiUser = createdUser.data.user
    }
    apiUserId = apiUser.id
    const role = await service.from('user_roles').upsert(
      { user_id: apiUser.id, role: 'admin', updated_by: apiUser.id },
      { onConflict: 'user_id' }
    )
    if (role.error) throw role.error
    const signed = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
    const auth = await signed.auth.signInWithPassword({ email: apiEmail, password })
    if (auth.error) throw auth.error
    const created = await signed.rpc('create_sale_with_items', { p_payload: { sale: { sale_date: new Date().toISOString(), payment_method: 'efectivo', customer_name: 'E2E Margin', status: 'completed' }, lines: [{ line_type: 'product', product_id: productId, quantity: 1 }] } })
    if (created.error) throw created.error
    saleId = Number(created.data.sale.id)
    const item = await service.from('sale_items').select('id').eq('sale_id', saleId).single()
    if (item.error) throw item.error
    itemId = item.data.id

    await login(page)
    await page.goto('/?tab=margin_reports')
    await expect(page.getByTestId('margin-report-panel')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(name)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('margin-kpi-net')).toBeVisible()
    const axe = await new AxeBuilder({ page }).include('[data-testid="margin-report-panel"]').withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(axe.violations.filter((violation) => violation.impact === 'critical')).toEqual([])
  })
})
