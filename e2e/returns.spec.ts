/**
 * E2E Stage 6.3 — devolución parcial y nota de crédito.
 * Mutaciones exclusivamente contra Supabase local E2E_*.
 */
import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { createClient } from '@supabase/supabase-js'
import {
  ensureE2EAdmin,
  getE2EEnv,
  requireE2E,
  serviceClient,
} from './helpers/fixtures'

async function login(page: Page) {
  const { email, password } = getE2EEnv()
  await ensureE2EAdmin()
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
}

test.describe('Stage 6.3 devoluciones', () => {
  let productId: number | null = null
  let saleId: number | null = null
  let saleItemId: number | null = null

  test.beforeEach(() => requireE2E())

  test.afterAll(async () => {
    if (!saleId) return
    const service = serviceClient()
    const { data: returns } = await service.from('sale_returns').select('id').eq('sale_id', saleId)
    const ids = (returns || []).map((r) => r.id)
    if (ids.length) {
      await service.from('sale_return_events').delete().in('return_id', ids)
      await service.from('sale_return_items').delete().in('return_id', ids)
      await service.from('sale_returns').delete().in('id', ids)
    }
    if (saleItemId) await service.from('sale_item_components').delete().eq('sale_item_id', saleItemId)
    await service.from('stock_movements').delete().eq('reference_type', 'sale').eq('reference_id', saleId)
    await service.from('sale_items').delete().eq('sale_id', saleId)
    await service.from('sales').delete().eq('id', saleId)
    if (productId) await service.from('products').delete().eq('id', productId)
  })

  test('emite nota parcial, reintegra stock y conserva venta', async ({ page }) => {
    const { url, anon, email, password } = getE2EEnv()
    await ensureE2EAdmin()
    const service = serviceClient()
    const { data: existingCategory } = await service
      .from('categories')
      .select('id')
      .limit(1)
      .maybeSingle()
    let categoryId = existingCategory?.id
    if (!categoryId) {
      const createdCategory = await service
        .from('categories')
        .insert({ name: `E2E Return Cat ${Date.now()}` })
        .select('id')
        .single()
      if (createdCategory.error) throw createdCategory.error
      categoryId = createdCategory.data.id
    }
    const name = `E2E Return ${Date.now()}`
    const { data: product, error: productError } = await service.from('products').insert({
      name, category_id: categoryId, sale_price: 1200, purchase_price: 500,
      stock: 10, min_stock: 1, visible_in_catalog: false,
    }).select('id').single()
    if (productError) throw productError
    productId = product.id

    const signed = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const auth = await signed.auth.signInWithPassword({ email, password })
    if (auth.error) throw auth.error
    const created = await signed.rpc('create_sale_with_items', {
      p_payload: {
        sale: {
          sale_date: new Date().toISOString(), payment_method: 'efectivo',
          customer_name: 'E2E Return', status: 'completed',
        },
        lines: [{ line_type: 'product', product_id: productId, quantity: 2 }],
      },
    })
    if (created.error) throw created.error
    saleId = Number(created.data.sale.id)
    const item = await service.from('sale_items').select('id').eq('sale_id', saleId).single()
    if (item.error) throw item.error
    saleItemId = item.data.id

    await login(page)
    await page.goto('/?tab=returns')
    await expect(page.getByTestId('devoluciones-panel')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('returns-search').fill(String(saleId))
    await page.getByTestId(`return-sale-${saleId}`).click()
    await page.getByTestId(`return-qty-${saleItemId}`).fill('1')
    await page.getByTestId('return-reason').fill('Cambio solicitado E2E')

    const axe = await new AxeBuilder({ page })
      .include('[data-testid="devoluciones-panel"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    expect(axe.violations.filter((v) => v.impact === 'critical')).toEqual([])

    await page.getByTestId('return-submit').click()
    await page.getByTestId('confirm-sale-return-confirm').click()
    await expect(page.getByTestId('returns-tab-history')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-testid^="return-row-"]').first()).toContainText(`Venta #${saleId}`)

    const stock = await service.from('products').select('stock').eq('id', productId).single()
    expect(stock.data?.stock).toBe(9)
    const original = await service.from('sales').select('id, total').eq('id', saleId).single()
    expect(original.data?.id).toBe(saleId)
    expect(Number(original.data?.total)).toBe(2400)
  })
})
