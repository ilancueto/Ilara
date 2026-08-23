import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accesibilidad (axe + teclado)', () => {
  test('login: sin violaciones críticas axe', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )
    expect(critical, JSON.stringify(critical, null, 2)).toEqual([])
  })

  test('catálogo: sin violaciones críticas axe', async ({ page }) => {
    await page.goto('/catalogo', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#catalogo-titulo-principal')).toBeVisible({ timeout: 15000 })
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )
    expect(critical, JSON.stringify(critical, null, 2)).toEqual([])
  })

  test('catálogo: la galería o su placeholder son accesibles', async ({ page }) => {
    await page.goto('/catalogo', { waitUntil: 'domcontentloaded' })
    const preview = page.getByRole('button', { name: /Ampliar imágenes de/ }).first()
    if (await preview.count() === 0) {
      await expect(page.getByRole('img', { name: /sin imagen/ }).first()).toBeVisible()
      return
    }
    await preview.focus()
    await expect(preview).toBeFocused()
    await preview.press('Enter')
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Cerrar' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('login: recorrido teclado enfoca email y envía con Enter', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    const email = page.locator('#login-form-card input[type="email"]')
    await email.focus()
    await expect(email).toBeFocused()
    await email.pressSequentially('e2e@example.com', { delay: 10 })
    await page.keyboard.press('Tab')
    const password = page.locator('#login-form-card input[type="password"]')
    await password.pressSequentially('not-a-real-password', { delay: 10 })
    await page.keyboard.press('Enter')
    await expect(
      page.getByText(/incorrectos|error|fetch|sesión|inválid/i).first()
    ).toBeVisible({ timeout: 15000 })
  })

  test('404 de ficha de catálogo inexistente (ruta pública)', async ({ page }) => {
    // Rutas privadas desconocidas redirigen a /login (proxy). notFound se prueba en prefijo público.
    await page.goto('/catalogo/p/999999991', { waitUntil: 'domcontentloaded' })
    await expect(
      page.getByRole('heading', { name: /no encontrada|no encontrado|producto/i }).first()
    ).toBeVisible({ timeout: 15000 })
  })
})
