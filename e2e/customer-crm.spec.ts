import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { ensureE2EAdmin, getE2EEnv, requireE2E, serviceClient } from './helpers/fixtures'

async function login(page: Page) {
  const { email, password } = getE2EEnv()
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

test.describe('Stage 6.5 CRM', () => {
  let customerId: number | null = null
  let tagId: number | null = null
  const tagName = `E2E VIP ${Date.now()}`
  const customerLastName = `CRM${Date.now()}`

  test.beforeEach(() => requireE2E())
  test.afterAll(async () => {
    const service = serviceClient()
    if (customerId) {
      await service.from('customer_tag_assignments').delete().eq('customer_id', customerId)
      await service.from('customer_notes').delete().eq('customer_id', customerId)
      await service.from('customer_consent_events').delete().eq('customer_id', customerId)
    }
    if (tagId) await service.from('customer_tags').delete().eq('id', tagId)
    if (customerId) await service.from('customers').delete().eq('id', customerId)
  })

  test('admin gestiona etiqueta, nota y consentimiento', async ({ page }) => {
    await ensureE2EAdmin()
    const service = serviceClient()
    const customer = await service.from('customers').insert({ first_name: 'E2E', last_name: customerLastName, phone: '2990000000' }).select('id').single()
    if (customer.error) throw customer.error
    customerId = customer.data.id

    await login(page)
    await page.goto('/?tab=customers')
    await page.getByPlaceholder('Buscar cliente...').fill(customerLastName)
    await expect(page.getByText(`E2E ${customerLastName}`)).toBeVisible()
    await page.getByRole('button', { name: 'Ver perfil' }).click()
    await expect(page.getByTestId('customer-crm-panel')).toBeVisible({ timeout: 20_000 })

    await page.getByTestId('crm-new-tag').fill(tagName)
    await page.getByRole('button', { name: 'Crear', exact: true }).click()
    await expect(page.getByText(tagName)).toBeVisible()
    const storedTag = await service.from('customer_tags').select('id').eq('name', tagName).single()
    if (storedTag.error) throw storedTag.error
    tagId = storedTag.data.id

    await page.getByTestId('crm-note-input').fill('Cliente prefiere mensajes por la tarde')
    await page.getByTestId('crm-add-note').click()
    await expect(page.getByText('Cliente prefiere mensajes por la tarde')).toBeVisible()

    await page.getByTestId('crm-consent-grant').click()
    await expect(page.getByTestId('crm-consent-status')).toContainText('Autorizado')

    const axe = await new AxeBuilder({ page }).include('[data-testid="customer-crm-panel"]').withTags(['wcag2a', 'wcag2aa']).disableRules(['color-contrast']).analyze()
    expect(axe.violations.filter((violation) => violation.impact === 'critical')).toEqual([])
  })
})
