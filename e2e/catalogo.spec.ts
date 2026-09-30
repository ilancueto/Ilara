import { test, expect } from '@playwright/test'

test.describe('Catálogo público', () => {
  for (const width of [390, 1440]) {
    test(`ficha, bolsa y formulario de pedido funcionan a ${width}px sin enviar el pedido`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/catalogo')
      const availableProduct = page.locator('article').filter({
        has: page.getByRole('button', { name: 'Agregar a la bolsa', exact: true }),
      }).filter({ has: page.locator('a[href^="/catalogo/p/"]') }).first()
      await expect(availableProduct).toBeVisible()
      await availableProduct.locator('a[href^="/catalogo/p/"]').first().click()
      await expect(page).toHaveURL(/\/catalogo\/p\/\d+/)
      const add = page.locator('main').getByRole('button', { name: /^Agregar a la bolsa/ }).first()
      await expect(add).toBeEnabled()
      await add.click()
      await page.getByRole('banner').getByRole('button', { name: /^Ver bolsa/ }).click()
      await expect(page.getByTestId('cart-checkout')).toBeEnabled()
      await page.getByTestId('cart-checkout').click()
      await expect(page.getByTestId('checkout-pedido')).toBeVisible()
      await expect(page.getByTestId('checkout-name')).toBeVisible()
      await expect(page.getByTestId('checkout-phone')).toBeVisible()
      await expect(page.getByTestId('checkout-email')).toBeVisible()
      await expect(page.getByTestId('fulfillment-options')).toBeVisible()
      await expect(page.getByTestId('checkout-submit')).toBeVisible()
    })
  }

  test('carga la página del catálogo y muestra la marca Ilara', async ({ page }) => {
    await page.goto('/catalogo', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveTitle(/Ilara|Catálogo/i)
    // Header/hero actual: logo "Ilara" + eyebrow "Ilara Beauty" (no h1 con ese texto exacto).
    await expect(page.locator('#catalogo-titulo-principal')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Ilara/i).first()).toBeAttached({ timeout: 10000 })
  })

  test('muestra el enlace para ingresar', async ({ page }) => {
    await page.goto('/catalogo', { waitUntil: 'domcontentloaded' })
    await expect(
      page.getByRole('contentinfo').getByRole('link', { name: 'Ingresar' })
    ).toBeVisible({ timeout: 10000 })
  })

  test('muestra el buscador de productos', async ({ page }) => {
    await page.goto('/catalogo', { waitUntil: 'domcontentloaded' })
    await expect(
      page.getByRole('searchbox', { name: /buscar productos/i })
    ).toBeVisible({ timeout: 10000 })
  })

  test('una ficha inexistente responde 404 real', async ({ request }) => {
    const response = await request.get('/catalogo/p/999999991')
    expect(response.status()).toBe(404)
    expect(await response.text()).not.toContain('"@type":"Product"')
  })

  test('la búsqueda vacía coincide entre HTML inicial e hidratación', async ({ page, request }) => {
    const response = await request.get('/catalogo?q=inexistenteprueba')
    expect(response.status()).toBe(200)
    expect(await response.text()).toContain('No encontramos productos')
    await page.goto('/catalogo?q=inexistenteprueba')
    await expect(page.getByRole('searchbox', { name: /buscar productos/i })).toHaveValue('inexistenteprueba')
    await expect(page.locator('a[href^="/catalogo/p/"]')).toHaveCount(0)
  })

  test('más vendidos conserva el orden del HTML al hidratar', async ({ page, request }) => {
    const path = '/catalogo?sort=vendidos-desc'
    const response = await request.get(path)
    expect(response.status()).toBe(200)
    const html = await response.text()
    const serverLinks = [...new Set([...html.matchAll(/href="(\/catalogo\/p\/\d+)"/g)].map(match => match[1]))]
    expect(serverLinks.length).toBeGreaterThan(0)
    await page.goto(path)
    await expect(page.getByRole('searchbox', { name: /buscar productos/i })).toBeVisible()
    const browserLinks = await page.locator('a[href^="/catalogo/p/"]').evaluateAll(links =>
      [...new Set(links.map(link => link.getAttribute('href')))])
    expect(browserLinks).toEqual(serverLinks)
  })
})
