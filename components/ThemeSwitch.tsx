'use client'

import { useCallback, useContext, useSyncExternalStore } from 'react'
import { ThemeContext, type Theme } from '@/context/ThemeContext'
import { Sun, Moon } from 'lucide-react'

const STORAGE_KEY = 'ilara-theme'

function subscribeHtmlClass(onStoreChange: () => void) {
  if (typeof document === 'undefined') return () => {}
  const el = document.documentElement
  const mo = new MutationObserver(onStoreChange)
  mo.observe(el, { attributes: true, attributeFilter: ['class'] })
  return () => mo.disconnect()
}

function getDomTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/**
 * En algunos prerenders de Next 16 (p. ej. ficha `/catalogo/p/[id]`), `ThemeContext` puede no
 * inyectarse aún en el árbol del cliente. Sin throw: leemos el tema desde `<html class>` (mismo
 * criterio que `ilara-theme-init.js` + ThemeProvider).
 */
export default function ThemeSwitch() {
  const ctx = useContext(ThemeContext)
  const domTheme = useSyncExternalStore(subscribeHtmlClass, getDomTheme, () => 'light')

  const theme = ctx?.theme ?? domTheme

  const toggleTheme = useCallback(() => {
    if (ctx) {
      ctx.toggleTheme()
      return
    }
    const next = getDomTheme() === 'light' ? 'dark' : 'light'
    document.documentElement.classList.toggle('dark', next === 'dark')
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [ctx])

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
      aria-label={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
      title={theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
    >
      {theme === 'light' ? (
        <Moon className="w-5 h-5" strokeWidth={2} />
      ) : (
        <Sun className="w-5 h-5" strokeWidth={2} />
      )}
    </button>
  )
}
