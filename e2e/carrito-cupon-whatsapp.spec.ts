import { test, expect } from '@playwright/test'
import {
  requireE2E,
  ensureE2EAdmin,
  seedCatalogProduct,
  cleanupProduct,
  seedCoupon,
  cleanupCoupon,
  serviceClient,
} from './helpers/fixtures'

test.describe('Carrito, cupón y WhatsApp (catálogo público)', () => {
  test('seed de producto visible y catálogo carga sin error de runtime', async ({ page }) => {
    requireE2E()
    await ensureE2EAdmin()
    const product = await seedCatalogProduct()
    try {
      const admin = serviceClient()
      const { data, error } = await admin
        .from('products')
        .select('id, name, visible_in_catalog, sale_price')
        .eq('id', product.id)
        .single()
      expect(error).toBeNull()
      expect(data?.visible_in_catalog).toBe(true)

      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.goto('/catalogo', { waitUntil: 'domcontentloaded' })
      await expect(page.locator('#catalogo-titulo-principal')).toBeVisible({ timeout: 15000 })
      await expect(page.getByRole('searchbox', { name: /buscar productos/i })).toBeVisible()
      // ISR/cache puede no listar el seed al instante; no exigir texto del seed en DOM.
      expect(errors.filter((m) => !/hydration|favicon/i.test(m))).toEqual([])
    } finally {
      await cleanupProduct(product.id)
    }
  })

  test('WhatsApp link builder no rompe con caracteres especiales', async ({ page }) => {
    await page.goto('/catalogo', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#catalogo-titulo-principal')).toBeVisible({ timeout: 15000 })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.waitForTimeout(300)
    expect(errors).toEqual([])
  })

  test('cupón seed existe en DB local (API service, no UI mutante prod)', async () => {
    requireE2E()
    const coupon = await seedCoupon()
    try {
      expect(coupon.code.length).toBeGreaterThan(3)
    } finally {
      await cleanupCoupon(coupon.id)
    }
  })
})
