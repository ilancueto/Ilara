import { test, expect, type Page, type Route } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {
  requireE2E,
  ensureE2EAdmin,
  getE2EEnv,
  seedCatalogProduct,
  cleanupProduct,
  seedCustomer,
  cleanupCustomer,
  seedExpense,
  cleanupExpense,
  resolveE2EAdminUserId,
  serviceClient,
} from './helpers/fixtures'

async function loginAsE2EAdmin(page: Page) {
  const { email, password } = getE2EEnv()
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  const emailInput = page.locator('#login-form-card input[type="email"]')
  const passInput = page.locator('#login-form-card input[type="password"]')
  await emailInput.click()
  await emailInput.fill('')
  await emailInput.pressSequentially(email, { delay: 10 })
  await passInput.click()
  await passInput.fill('')
  await passInput.pressSequentially(password, { delay: 10 })
  await page.locator('#login-form-card form').evaluate((form) => {
    ;(form as HTMLFormElement).requestSubmit()
  })
  await expect(page).not.toHaveURL(/\/login/, { timeout: 25000 })
}

async function assertFocusTrapped(page: Page, panelTestId: string) {
  await expect
    .poll(() =>
      page.evaluate((tid) => {
        const root = document.querySelector(`[data-testid="${tid}"]`)
        return Boolean(root && root.contains(document.activeElement))
      }, panelTestId)
    )
    .toBe(true)

  await page.keyboard.press('Tab')
  const afterTab = await page.evaluate((tid) => {
    const root = document.querySelector(`[data-testid="${tid}"]`)
    return Boolean(root && root.contains(document.activeElement))
  }, panelTestId)
  expect(afterTab).toBe(true)

  await page.keyboard.press('Shift+Tab')
  const afterShift = await page.evaluate((tid) => {
    const root = document.querySelector(`[data-testid="${tid}"]`)
    return Boolean(root && root.contains(document.activeElement))
  }, panelTestId)
  expect(afterShift).toBe(true)
}

async function assertNoSeriousAxeInDialog(page: Page, dialogTestId: string) {
  const results = await new AxeBuilder({ page })
    .include(`[data-testid="${dialogTestId}"]`)
    .withTags(['wcag2a', 'wcag2aa'])
    .disableRules(['color-contrast'])
    .analyze()
  const critical = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  )
  expect(critical, JSON.stringify(critical, null, 2)).toEqual([])
}

/**
 * Retrasa DELETE REST de una tabla para poder asertar loading / no-dismiss.
 * resolve() del gate se invoca para liberar la request.
 */
function installDeleteDelay(
  page: Page,
  table: 'products' | 'customers' | 'expenses'
): { release: () => void; waitHit: () => Promise<void> } {
  let hitResolve: (() => void) | null = null
  const hitPromise = new Promise<void>((r) => {
    hitResolve = r
  })
  let releaseResolve: (() => void) | null = null
  const gate = new Promise<void>((r) => {
    releaseResolve = r
  })

  const handler = async (route: Route) => {
    if (route.request().method() !== 'DELETE') {
      await route.continue()
      return
    }
    hitResolve?.()
    hitResolve = null
    await gate
    await route.continue()
  }

  // Supabase REST: /rest/v1/{table}?id=eq...
  void page.route(new RegExp(`/rest/v1/${table}(\\?|$)`), handler)

  return {
    release: () => {
      releaseResolve?.()
      releaseResolve = null
    },
    waitHit: () => hitPromise,
  }
}

/**
 * A11Y + mutaciones bulk destructivas (Supabase local vía E2E_* únicamente).
 */
test.describe('Bulk dialogs accesibles', () => {
  test('inventario: bulk delete — foco, Escape, cancelar no elimina', async ({ page }) => {
    requireE2E()
    await ensureE2EAdmin()
    const product = await seedCatalogProduct()
    try {
      await loginAsE2EAdmin(page)
      await page.goto('/?tab=inventory', { waitUntil: 'domcontentloaded' })
      await expect(page.getByText(/inventario/i).first()).toBeVisible({ timeout: 20000 })

      await page.getByRole('button', { name: /eliminar productos/i }).click()

      const dialog = page.getByTestId('bulk-delete-productos')
      await expect(dialog).toBeVisible({ timeout: 10000 })
      await expect(page.getByTestId('bulk-delete-productos-panel')).toBeVisible()
      await assertFocusTrapped(page, 'bulk-delete-productos-panel')
      await assertNoSeriousAxeInDialog(page, 'bulk-delete-productos')

      await expect(dialog.getByText(/seleccioná los productos a eliminar/i)).toBeVisible()
      await expect(dialog.getByText(/0 seleccionado/i)).toBeVisible()

      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0, { timeout: 5000 })

      const admin = serviceClient()
      const { data } = await admin
        .from('products')
        .select('id')
        .eq('id', product.id)
        .maybeSingle()
      expect(data?.id).toBe(product.id)
    } finally {
      await cleanupProduct(product.id)
    }
  })

  test('inventario: bulk delete CONFIRMA — UI + Supabase local y cleanup', async ({ page }) => {
    requireE2E()
    await ensureE2EAdmin()
    const product = await seedCatalogProduct()
    const delay = installDeleteDelay(page, 'products')
    try {
      await loginAsE2EAdmin(page)
      await page.goto('/?tab=inventory', { waitUntil: 'domcontentloaded' })
      await expect(page.getByText(product.name).first()).toBeVisible({ timeout: 20000 })

      await page.getByRole('button', { name: /eliminar productos/i }).click()
      const dialog = page.getByTestId('bulk-delete-productos')
      await expect(dialog).toBeVisible({ timeout: 10000 })
      await assertNoSeriousAxeInDialog(page, 'bulk-delete-productos')

      // Solo el producto seed (no select-all)
      await page.getByTestId(`bulk-delete-productos-list-item-${product.id}`).check()
      await expect(dialog.getByText(/1 seleccionado/i)).toBeVisible()
      await expect(page.getByTestId('bulk-delete-productos-confirm')).toHaveText(
        /eliminar 1 producto/i
      )

      await page.getByTestId('bulk-delete-productos-confirm').click()
      await delay.waitHit()

      // Durante submit: no Escape/backdrop; botón en loading
      await expect(page.getByTestId('bulk-delete-productos-confirm')).toBeDisabled()
      await expect(page.getByTestId('bulk-delete-productos-confirm')).toHaveText(/eliminando/i)
      await page.keyboard.press('Escape')
      await expect(dialog).toBeVisible()
      await page.getByTestId('bulk-delete-productos-backdrop').click({ position: { x: 2, y: 2 } })
      await expect(dialog).toBeVisible()

      // Segundo click no re-dispara (botón disabled)
      await page.getByTestId('bulk-delete-productos-confirm').click({ force: true }).catch(() => {})

      delay.release()
      await expect(dialog).toHaveCount(0, { timeout: 15000 })
      await expect(page.getByText(product.name)).toHaveCount(0, { timeout: 10000 })

      const admin = serviceClient()
      const { data } = await admin
        .from('products')
        .select('id')
        .eq('id', product.id)
        .maybeSingle()
      expect(data).toBeNull()
    } finally {
      delay.release()
      await cleanupProduct(product.id)
    }
  })

  test('clientes: bulk delete — cancelar con botón no muta', async ({ page }) => {
    requireE2E()
    await ensureE2EAdmin()
    const customer = await seedCustomer()
    try {
      await loginAsE2EAdmin(page)
      await page.goto('/?tab=customers', { waitUntil: 'domcontentloaded' })
      await expect(page.getByText(/clientes/i).first()).toBeVisible({ timeout: 20000 })

      await page.getByRole('button', { name: /eliminar clientes/i }).click()
      const dialog = page.getByTestId('bulk-delete-clientes')
      await expect(dialog).toBeVisible({ timeout: 10000 })
      await assertFocusTrapped(page, 'bulk-delete-clientes-panel')
      await assertNoSeriousAxeInDialog(page, 'bulk-delete-clientes')

      await page.getByTestId('bulk-delete-clientes-cancel').click()
      await expect(dialog).toHaveCount(0, { timeout: 5000 })

      const admin = serviceClient()
      const { data } = await admin
        .from('customers')
        .select('id')
        .eq('id', customer.id)
        .maybeSingle()
      expect(data?.id).toBe(customer.id)
    } finally {
      await cleanupCustomer(customer.id)
    }
  })

  test('clientes: bulk delete CONFIRMA — UI + Supabase local y cleanup', async ({ page }) => {
    requireE2E()
    await ensureE2EAdmin()
    const customer = await seedCustomer()
    const delay = installDeleteDelay(page, 'customers')
    try {
      await loginAsE2EAdmin(page)
      await page.goto('/?tab=customers', { waitUntil: 'domcontentloaded' })
      await expect(page.getByText(customer.label).first()).toBeVisible({ timeout: 20000 })

      await page.getByRole('button', { name: /eliminar clientes/i }).click()
      const dialog = page.getByTestId('bulk-delete-clientes')
      await expect(dialog).toBeVisible({ timeout: 10000 })
      await assertNoSeriousAxeInDialog(page, 'bulk-delete-clientes')

      await page.getByTestId(`bulk-delete-clientes-list-item-${customer.id}`).check()
      await expect(dialog.getByText(/1 seleccionado/i)).toBeVisible()
      await expect(dialog.getByText(/ventas asociadas quedarán sin cliente/i)).toBeVisible()
      await expect(page.getByTestId('bulk-delete-clientes-confirm')).toHaveText(
        /eliminar 1 cliente/i
      )

      await page.getByTestId('bulk-delete-clientes-confirm').click()
      await delay.waitHit()
      await expect(page.getByTestId('bulk-delete-clientes-confirm')).toBeDisabled()
      await expect(page.getByTestId('bulk-delete-clientes-confirm')).toHaveText(/eliminando/i)
      await page.keyboard.press('Escape')
      await expect(dialog).toBeVisible()

      delay.release()
      await expect(dialog).toHaveCount(0, { timeout: 15000 })
      await expect(page.getByText(customer.label)).toHaveCount(0, { timeout: 10000 })

      const admin = serviceClient()
      const { data } = await admin
        .from('customers')
        .select('id')
        .eq('id', customer.id)
        .maybeSingle()
      expect(data).toBeNull()
    } finally {
      delay.release()
      await cleanupCustomer(customer.id)
    }
  })

  test('gastos: bulk dialog abre y Escape cierra', async ({ page }) => {
    requireE2E()
    await ensureE2EAdmin()
    const userId = await resolveE2EAdminUserId()
    const expense = await seedExpense(userId)
    try {
      await loginAsE2EAdmin(page)
      await page.goto('/gastos', { waitUntil: 'domcontentloaded' })
      await expect(page.getByText(/gastos/i).first()).toBeVisible({ timeout: 20000 })
      await page.getByRole('button', { name: /eliminar gastos/i }).click()
      const dialog = page.getByTestId('bulk-delete-gastos')
      await expect(dialog).toBeVisible({ timeout: 10000 })
      await assertFocusTrapped(page, 'bulk-delete-gastos-panel')
      await assertNoSeriousAxeInDialog(page, 'bulk-delete-gastos')
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0, { timeout: 5000 })
    } finally {
      await cleanupExpense(expense.id)
    }
  })

  test('ventas: bulk dialog abre y cancelar cierra', async ({ page }) => {
    requireE2E()
    await ensureE2EAdmin()
    await loginAsE2EAdmin(page)
    await page.goto('/?tab=incomes', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /cuentas y caja/i }).first()).toBeVisible({
      timeout: 20000,
    })
    await page.getByRole('button', { name: /^ventas$/i }).click()
    const btn = page.getByRole('button', { name: /eliminar ventas/i })
    await btn.scrollIntoViewIfNeeded()
    await expect(btn).toBeVisible({ timeout: 15000 })
    await btn.click()
    const dialog = page.getByTestId('bulk-delete-ventas')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await assertNoSeriousAxeInDialog(page, 'bulk-delete-ventas')
    await page.getByTestId('bulk-delete-ventas-cancel').click()
    await expect(dialog).toHaveCount(0)
  })
})
