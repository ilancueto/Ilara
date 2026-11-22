'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'

const KEY = 'ilara_favoritos_v1'
const EMPTY = '[]'
const listeners = new Set<() => void>()

function read(): string {
  try {
    return window.localStorage.getItem(KEY) ?? EMPTY
  } catch {
    return EMPTY
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

function parse(raw: string): number[] {
  try {
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) ? value.filter((n): n is number => Number.isInteger(n)) : []
  } catch {
    return []
  }
}

/** "Mi lista": productos guardados con el corazón. Quedan en este dispositivo (no requiere cuenta). */
export function useFavoritos() {
  const raw = useSyncExternalStore(subscribe, read, () => EMPTY)
  const ids = useMemo(() => parse(raw), [raw])
  const set = useMemo(() => new Set(ids), [ids])

  const toggle = useCallback((id: number) => {
    const current = parse(read())
    const next = current.includes(id) ? current.filter((n) => n !== id) : [...current, id]
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* sin almacenamiento disponible: no se guarda */
    }
    listeners.forEach((listener) => listener())
  }, [])

  return { ids, has: (id: number) => set.has(id), toggle }
}
