import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { ensureE2EAdmin, getE2EEnv, requireE2E, serviceClient } from './helpers/fixtures'

async function login(page: Page) {
  const { email, password } = getE2EEnv()
  await ensureE2EAdmin()
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  const emailInput = page.locator('#login-form-card input[type="email"]')
  const passwordInput = page.locator('#login-form-card input[type="password"]')
  await emailInput.fill('')
  await emailInput.pressSequentially(email, { delay: 10 })
  await passwordInput.fill('')
  await passwordInput.pressSequentially(password, { delay: 10 })
  await page.locator('#login-form-card form').evaluate((form) => (form as HTMLFormElement).requestSubmit())
  await expect(page).not.toHaveURL(/\/login/, { timeout: 25_000 })
}

test.describe('Stage 6.6 cuentas y conciliación', () => {
  const counterparty = `E2E Proveedor ${Date.now()}`
  let accountId: string | null = null

  test.beforeEach(() => requireE2E())
  test.afterAll(async () => {
    const service = serviceClient()
    if (!accountId) {
      const account = await service.from('financial_accounts').select('id').eq('counterparty', counterparty).maybeSingle()
      accountId = account.data?.id ?? null
    }
    if (accountId) {
      const movements = await service.from('financial_movements').select('expense_id').eq('account_id', accountId)
      const expenseIds = (movements.data || []).map((row) => row.expense_id).filter(Boolean)
      await service.from('financial_movements').delete().eq('account_id', accountId)
      await service.from('financial_accounts').delete().eq('id', accountId)
      if (expenseIds.length) await service.from('expenses').delete().in('id', expenseIds)
    }
  })

  test('registra una CxP y un pago parcial auditable', async ({ page }) => {
    await login(page)
    await page.goto('/?tab=incomes')
    await page.getByRole('button', { name: 'Cuentas y caja' }).click()
    await expect(page.getByTestId('finance-ledger')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Cuentas por pagar' }).click()
    await page.getByRole('button', { name: 'Nueva cuenta por pagar' }).click()
    await page.getByLabel('Proveedor o acreedor').fill(counterparty)
    await page.getByLabel('Concepto').fill('Insumos E2E Stage 6.6')
    await page.getByLabel('Monto').fill('900')
    await page.getByRole('button', { name: 'Registrar deuda' }).click()
    await expect(page.getByText(counterparty)).toBeVisible({ timeout: 15_000 })

    const service = serviceClient()
    const account = await service.from('financial_accounts').select('id').eq('counterparty', counterparty).single()
    if (account.error) throw account.error
    accountId = account.data.id

    await page.getByRole('button', { name: 'Registrar pago' }).click()
    await page.getByLabel('Monto').fill('300')
    await page.getByLabel('Medio').selectOption('transferencia')
    await page.getByLabel('Nota opcional').fill('Primer pago parcial E2E')
    await page.getByRole('button', { name: 'Confirmar movimiento' }).click()
    await expect(page.getByText('Parcial', { exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('$ 600').last()).toBeVisible()

    const stored = await service.from('financial_movements').select('amount, payment_method, created_by').eq('account_id', accountId).single()
    expect(stored.error).toBeNull()
    expect(stored.data).toEqual(expect.objectContaining({ payment_method: 'transferencia' }))

    const axe = await new AxeBuilder({ page }).include('[data-testid="finance-ledger"]').withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(axe.violations.filter((violation) => violation.impact === 'critical')).toEqual([])
  })
})
