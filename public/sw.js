/**
 * Ilara — service worker mínimo (solo online).
 *
 * Propósito:
 * - Cumplir criterios de instalación en Chromium (registro + fetch handler).
 * - Vaciar CacheStorage residual de implementaciones anteriores.
 * - Nunca servir desde almacenamiento local del SW ni simular éxito sin red.
 *
 * Comportamiento de red:
 * - No rellena CacheStorage con assets ni datos.
 * - El listener fetch no toma control de la respuesta: el navegador usa la red.
 * - Sin conexión, las peticiones fallan como en cualquier web online.
 */
const SW_VERSION = 'ilara-sw-online-only-v1'

// Nombres creados por la implementación anterior de Ilara. No borrar caches
// arbitrarios: CacheStorage es compartido por todo el origen.
const LEGACY_ILARA_CACHE = /^(?:serwist|workbox|next-pwa)(?:[-_:]|$)|^ilara-supabase-catalog$/i

self.addEventListener('install', (event) => {
  // Activar de inmediato para no dejar clientes en un SW viejo indefinidamente.
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Eliminar sólo entradas residuales de Ilara (Serwist / Workbox / build viejo).
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => LEGACY_ILARA_CACHE.test(key))
          .map((key) => caches.delete(key))
      )
      await self.clients.claim()
    })()
  )
})

/**
 * Fetch handler vacío a propósito:
 * - Chromium lo usa como señal de app instalable.
 * - Al no tomar la respuesta, no hay interceptación de navegación, API ni Supabase.
 */
self.addEventListener('fetch', () => {
  // network-only por omisión del navegador
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports?.[0]?.postMessage({ version: SW_VERSION })
  }
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
