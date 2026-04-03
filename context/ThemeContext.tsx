'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const STORAGE_KEY = 'ilara-theme'

export type Theme = 'light' | 'dark'

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
  if (stored === 'dark') return 'dark'
  return 'light'
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  // Montar: localStorage o claro por defecto (mismo criterio que el script del layout).
  // Sincronizar estado tras hidratar; el setState en mount es intencional para evitar mismatch SSR.
  /* eslint-disable react-hooks/set-state-in-effect -- init tema desde localStorage solo en cliente */
  useEffect(() => {
    const initial = getInitialTheme()
    setThemeState(initial)
    setMounted(true)
    applyTheme(initial)
    localStorage.setItem(STORAGE_KEY, initial)
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Siempre que cambie el tema (toggle), aplicar en el DOM y persistir
  useEffect(() => {
    if (!mounted) return
    applyTheme(theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {}
  }, [mounted, theme])

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {}
    setThemeState(next)
  }, [])

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    applyTheme(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {}
    setThemeState(next)
  }, [theme])

  const value: ThemeContextValue = { theme, setTheme, toggleTheme }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
