import { test, expect } from '@playwright/test'

test.describe('PWA installable online-only', () => {
  test('manifest.json is valid and reachable', async ({ request }) => {
    const res = await request.get('/manifest.json')
    expect(res.status()).toBe(200)
    const ct = res.headers()['content-type'] || ''
    expect(ct).toMatch(/json|manifest/i)
    const manifest = await res.json()
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope || '/').toBe('/')
    expect(manifest.short_name).toBeTruthy()
    const icons = manifest.icons as Array<{ src: string; sizes: string }>
    expect(icons.some((i) => i.sizes === '192x192')).toBe(true)
    expect(icons.some((i) => i.sizes === '512x512')).toBe(true)
  })

  test('sw.js responds 200 with JavaScript and online-only body', async ({ request }) => {
    const res = await request.get('/sw.js')
    expect(res.status()).toBe(200)
    const ct = res.headers()['content-type'] || ''
    expect(ct).toMatch(/javascript|ecmascript/i)
    const body = await res.text()
    const code = body
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
    expect(code).toMatch(/addEventListener\(\s*['"]fetch['"]/)
    expect(code).not.toMatch(/\.respondWith\s*\(/)
    expect(code).not.toMatch(/caches\.open/)
  })

  test('PWA icons return 200', async ({ request }) => {
    for (const path of [
      '/icon-192.png',
      '/icon-512.png',
      '/icon-512-maskable.png',
      '/apple-touch-icon.png',
    ]) {
      const res = await request.get(path)
      expect(res.status(), path).toBe(200)
      const ct = res.headers()['content-type'] || ''
      expect(ct).toMatch(/image\/png/i)
    }
  })

  test('service worker registers and removes only legacy Ilara caches', async ({
    page,
  }) => {
    await page.goto('/catalogo', { waitUntil: 'networkidle', timeout: 30000 })

    // Esperar registro del SW (PwaRegister en layout)
    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            if (!('serviceWorker' in navigator)) return 'no-sw-api'
            const reg = await navigator.serviceWorker.getRegistration('/')
            return reg?.active?.scriptURL || reg?.installing?.scriptURL || reg?.waiting?.scriptURL || null
          }),
        { timeout: 15000 }
      )
      .toMatch(/\/sw\.js/)

    // Activar y reclamar clientes
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready
      return reg.active?.state
    })

    const cacheInfo = await page.evaluate(async () => {
      const keys = await caches.keys()
      const details: Record<string, number> = {}
      for (const key of keys) {
        const cache = await caches.open(key)
        details[key] = (await cache.keys()).length
      }
      return { keys, details }
    })

    // Tras activate no debe haber precache legado de Ilara. No se exige que
    // CacheStorage quede vacío: puede contener datos ajenos al worker.
    const forbidden = cacheInfo.keys.filter((k) =>
      /serwist|workbox|precache|ilara-supabase|runtime/i.test(k)
    )
    expect(forbidden).toEqual([])
  })

  test('fetch handler does not serve offline pages from cache', async ({ page }) => {
    await page.goto('/catalogo', { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })

    const swSource = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration('/')
      const url = reg?.active?.scriptURL
      if (!url) return ''
      const res = await fetch(url)
      return res.text()
    })
    const code = swSource
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
    expect(code).toMatch(/addEventListener\(\s*['"]fetch['"]/)
    expect(code).not.toMatch(/\.respondWith\s*\(/)
    expect(code).not.toMatch(/~offline/)
  })

  test('offline simulation does not invent success or queue sales', async ({ page, context }) => {
    await page.goto('/catalogo', { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })

    // Ir offline: las navegaciones posteriores deben fallar o mostrar error de red,
    // nunca una shell cacheada con datos de negocio “frescos”.
    await context.setOffline(true)

    const navResult = await page
      .goto('/catalogo', { waitUntil: 'domcontentloaded', timeout: 8000 })
      .then((r) => ({ ok: true as const, status: r?.status() ?? null }))
      .catch((e: Error) => ({ ok: false as const, message: e.message }))

    // Con SW network-only (sin respondWith), la navegación falla offline.
    if (navResult.ok) {
      // Si el browser reutiliza documento en memoria, no debe haber indicadores de venta offline
      const body = await page.locator('body').innerText().catch(() => '')
      expect(body).not.toMatch(/venta guardada offline|pendiente de sincronizar|cola de mutaciones/i)
    } else {
      expect(navResult.message).toMatch(/net::|offline|failed|ERR_/i)
    }

    await context.setOffline(false)
  })
})
