import { test, expect } from '@playwright/test'

test.describe('Auth y redirecciones', () => {
  test('raíz sin sesión redirige al catálogo', async ({ page }) => {
    await page.goto('/', { waitUntil: 'commit', timeout: 15000 })
    await expect(page).toHaveURL(/\/catalogo/, { timeout: 10000 })
  })

  test('ruta protegida sin sesión redirige a login', async ({ page }) => {
    await page.goto('/gastos', { waitUntil: 'commit', timeout: 15000 })
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
  })

  test('página de login carga y tiene formulario', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 15000 })
    await expect(page).toHaveTitle(/Ilara|Login|Iniciar/i)
    await expect(page.getByLabel(/email|correo/i).or(page.getByPlaceholder(/email|correo/i)).first()).toBeVisible({ timeout: 8000 })
    await expect(page.getByRole('button', { name: /iniciar|entrar|ingresar/i })).toBeVisible({ timeout: 5000 })
  })

  test('login no ofrece passkeys (contención SEC-01)', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 15000 })
    await expect(page.getByRole('button', { name: /huella|face id|passkey/i })).toHaveCount(0)
  })
})
