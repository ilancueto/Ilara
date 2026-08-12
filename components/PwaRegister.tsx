'use client'

import { useEffect } from 'react'

/**
 * Registra el service worker mínimo online-only (`/sw.js`).
 * No implementa offline, colas ni cache de datos.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    // Desactivar en pruebas unitarias / entornos sin SW deseado.
    if (process.env.NEXT_PUBLIC_DISABLE_SW === '1') return

    let cancelled = false
    let updateTimer: ReturnType<typeof setInterval> | undefined
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkUpdate()
    }

    let checkUpdate = () => {}

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })
        if (cancelled) return

        // Comprobar actualizaciones periódicamente (y al volver a la pestaña).
        checkUpdate = () => {
          registration.update().catch(() => {
            /* red caida: no bloquear UI */
          })
        }
        updateTimer = setInterval(checkUpdate, 60 * 60 * 1000)
        document.addEventListener('visibilitychange', onVisibilityChange)

        // Si hay un worker en waiting (deploys previos con Serwist), activarlo.
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        }
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing
          if (!worker) return
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })
      } catch {
        // Fallo de registro no debe romper login/catálogo/POS.
      }
    }

    void register()

    return () => {
      cancelled = true
      if (updateTimer) clearInterval(updateTimer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return null
}
