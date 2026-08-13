/**
 * E2E Stage 6.2 — alertas de reposición.
 * Solo Supabase local (E2E_* loopback).
 */
import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {
  requireE2E,
  ensureE2EAdmin,
  getE2EEnv,
  serviceClient,
} from './helpers/fixtures'

async function loginAsE2EAdmin(page: Page) {
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

test.describe('Stage 6.2 alertas de reposición', () => {
  test.beforeEach(() => {
    requireE2E()
  })

  let productId: number | null = null

  test.afterAll(async () => {
    if (!productId) return
    try {
      const admin = serviceClient()
      const { data: alerts } = await admin
        .from('stock_alerts')
        .select('id')
        .eq('product_id', productId)
      const ids = (alerts || []).map((a) => a.id)
      if (ids.length) {
        await admin.from('stock_alert_events').delete().in('alert_id', ids)
        await admin.from('stock_alerts').delete().in('id', ids)
      }
      await admin.from('products').delete().eq('id', productId)
    } catch {
      /* ignore */
    }
  })

  test('listar, tomar, resolver y axe en panel', async ({ page }) => {
    requireE2E()
    const admin = serviceClient()
    const name = `E2E Alert ${Date.now()}`
    const { data: cat } = await admin.from('categories').select('id').limit(1).maybeSingle()
    let categoryId = cat?.id as number | undefined
    if (!categoryId) {
      const ins = await admin.from('categories').insert({ name: 'E2E Alert Cat' }).select('id').single()
      if (ins.error) throw ins.error
      categoryId = ins.data.id
    }
    const { data: prod, error } = await admin
      .from('products')
      .insert({
        name,
        category_id: categoryId,
        brand: 'E2E',
        sale_price: 1000,
        stock: 1,
        min_stock: 5,
        visible_in_catalog: false,
      })
      .select('id')
      .single()
    if (error) throw error
    productId = prod.id as number

    // ensure alert exists
    const { data: alerts } = await admin
      .from('stock_alerts')
      .select('id, status')
      .eq('product_id', productId)
      .eq('status', 'open')
    expect(alerts?.length).toBe(1)

    await loginAsE2EAdmin(page)
    await page.goto('/?tab=stock_alerts')
    await expect(page.getByTestId('alertas-reposicion-panel')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('alertas-open-count')).toBeVisible()

    await page.getByTestId('alertas-search').fill(name.slice(0, 12))
    await page.waitForTimeout(400)
    await page.getByTestId(`alerta-row-${productId}`).click()
    await expect(page.getByTestId('alerta-detail')).toBeVisible()

    // Axe scoped to panel
    const axe = await new AxeBuilder({ page })
      .include('[data-testid="alertas-reposicion-panel"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast']) // residual chrome; critical a11y via keyboard/dialogs
      .analyze()
    const critical = axe.violations.filter((v) => v.impact === 'critical')
    expect(critical, JSON.stringify(critical.map((v) => v.id))).toEqual([])

    // Tomar
    await page.getByTestId('alerta-transition-in_progress').click()
    await page.getByTestId('confirm-alerta-confirm').click()
    await expect(page.getByTestId('alerta-detail').getByText('En curso', { exact: true })).toBeVisible({
      timeout: 15_000,
    })

    // Resolver con nota
    await page.getByTestId('alerta-transition-resolved').click()
    await expect(page.getByTestId('alerta-note-form')).toBeVisible()
    await page.getByTestId('alerta-note').fill('Pedido a proveedor E2E')
    await page.getByTestId('alerta-note-confirm').click()
    await page.getByTestId('confirm-alerta-confirm').click()
    await expect(page.getByTestId('alerta-detail').getByText('Resuelta', { exact: true })).toBeVisible({
      timeout: 15_000,
    })

    await expect(page.getByTestId('alerta-history')).toContainText('En curso')
    await expect(page.getByTestId('alerta-history')).toContainText('Resuelta')

    // Teclado: foco en search
    await page.getByTestId('alertas-search').focus()
    await expect(page.getByTestId('alertas-search')).toBeFocused()

    expect(getE2EEnv().url).toMatch(/127\.0\.0\.1|localhost/)
  })
})
