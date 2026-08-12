import { test, expect } from '@playwright/test'

/**
 * Viewport mobile vía proyecto Playwright `mobile-chrome` (Pixel 5 / Chromium).
 * No usa WebKit para no exigir browsers extra en CI.
 */
test.describe('Viewport mobile', () => {
  test('catálogo usable en mobile', async ({ page }) => {
    await page.goto('/catalogo', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#catalogo-titulo-principal')).toBeVisible({ timeout: 15000 })
    // Login puede estar en menú compacto; al menos el título y el buscador
    await expect(page.getByRole('searchbox', { name: /buscar productos/i })).toBeVisible({
      timeout: 10000,
    })
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 24)
  })

  test('login usable en mobile', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('textbox', { name: /^email$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /iniciar sesión/i })).toBeVisible()
  })

  test('diálogos: escape no rompe mobile (confirm pattern)', async ({ page }) => {
    await page.goto('/catalogo', { waitUntil: 'domcontentloaded' })
    await page.keyboard.press('Escape')
    await expect(page.locator('#catalogo-titulo-principal')).toBeVisible()
  })
})
