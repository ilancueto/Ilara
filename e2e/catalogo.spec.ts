import { test, expect } from '@playwright/test'

test.describe('Catálogo público', () => {
  test('carga la página del catálogo y muestra Ilara Beauty', async ({ page }) => {
    await page.goto('/catalogo', { waitUntil: 'domcontentloaded', timeout: 15000 })
    await expect(page).toHaveTitle(/Ilara|Catálogo/i)
    await expect(page.getByRole('heading', { name: /Ilara Beauty/i })).toBeVisible({ timeout: 10000 })
  })

  test('muestra el enlace de login', async ({ page }) => {
    await page.goto('/catalogo', { waitUntil: 'domcontentloaded', timeout: 15000 })
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible({ timeout: 10000 })
  })

  test('muestra el buscador de productos', async ({ page }) => {
    await page.goto('/catalogo', { waitUntil: 'domcontentloaded', timeout: 15000 })
    await expect(
      page.getByRole('searchbox', { name: /buscar productos/i })
    ).toBeVisible({ timeout: 10000 })
  })
})
