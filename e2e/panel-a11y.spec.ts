import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { requireE2E, ensureE2EAdmin, getE2EEnv } from './helpers/fixtures'

/** Pantallas principales del panel (pastel bento) que deben pasar axe en claro y en oscuro. */
const PANEL_TABS = [
  ['dashboard', 'Inicio'],
  ['inventory', 'Inventario'],
  ['sales', 'Punto de venta'],
  ['customers', 'Clientes'],
  ['negocio', 'Negocio'],
  ['incomes', 'Cuentas y caja'],
  ['expenses', 'Gastos'],
  ['orders', 'Pedidos'],
  ['margin_reports', 'Margen real'],
  ['returns', 'Devoluciones'],
] as const

async function loginAsE2EAdmin(page: Page) {
  const { email, password } = getE2EEnv()
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.locator('#login-form-card form').evaluate((form) => {
    ;(form as HTMLFormElement).requestSubmit()
  })
  await expect(page).not.toHaveURL(/\/login/, { timeout: 25000 })
}

/** axe mide colores reales: espera a que terminen las animaciones de entrada y la carga de datos. */
async function waitForSettledPanel(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => undefined)
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== 'running' || animation.effect?.getTiming().iterations === Infinity)
  )
}

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    // Los gráficos de Recharts dibujan SVG sin texto accesible propio; se cubren con el título de la tarjeta.
    .exclude('.recharts-wrapper')
    .analyze()
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`Panel accesible (${theme === 'light' ? 'claro' : 'oscuro'})`, () => {
    test.beforeEach(async ({ page }) => {
      requireE2E()
      await ensureE2EAdmin()
      await page.addInitScript((value) => localStorage.setItem('ilara-theme', value), theme)
      await loginAsE2EAdmin(page)
    })

    for (const [tab, title] of PANEL_TABS) {
      test(`${title}: sin violaciones críticas axe`, async ({ page }) => {
        await page.goto(`/?tab=${tab}`, { waitUntil: 'domcontentloaded' })
        await expect(page.locator('.app-topbar')).toContainText(title, { timeout: 20000 })
        await waitForSettledPanel(page)
        const critical = await seriousViolations(page)
        expect(critical, JSON.stringify(critical, null, 2)).toEqual([])
      })
    }
  })
}
