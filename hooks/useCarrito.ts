'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { PublicCatalogCombo, PublicCatalogProduct } from '@/lib/domain/catalog/publicDto'
import { fetchPublicCatalogSnapshot } from '@/lib/domain/catalog/publicQueries'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import { cartQuote, cartReferences, parseCartReferences, resolveCart, type CartCatalog, type CatalogCartItem } from '@/lib/domain/catalog/cart'
export type { CatalogCartItem } from '@/lib/domain/catalog/cart'

const STORAGE_KEY = 'ilara-carrito'
const STORAGE_UPDATED_AT = 'ilara-carrito-updated-at'
const CART_TTL_MS = 24 * 60 * 60 * 1000
type ShowToast = (type: 'success' | 'error' | 'warning' | 'info', message: string) => void

export function useCarrito(showToast: ShowToast) {
  const [carrito, setCarrito] = useState<CatalogCartItem[]>([])
  const [cartReady, setCartReady] = useState(false)
  const [badgeAnimado, setBadgeAnimado] = useState(false)
  const cartRef = useRef<CatalogCartItem[]>([])
  const catalogRef = useRef<CartCatalog | null>(null)
  const toastRef = useRef(showToast)
  useEffect(() => { toastRef.current = showToast }, [showToast])

  const save = useCallback((next: CatalogCartItem[]) => {
    cartRef.current = next
    setCarrito(next)
    try {
      if (next.length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cartReferences(next)))
        localStorage.setItem(STORAGE_UPDATED_AT, String(Date.now()))
      } else {
        localStorage.removeItem(STORAGE_KEY)
        localStorage.removeItem(STORAGE_UPDATED_AT)
      }
    } catch { /* Keep the cart usable in memory when storage is unavailable. */ }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const snap = await fetchPublicCatalogSnapshot(getBrowserSupabase())
        if (cancelled) return
        if (!snap.ok) throw new Error('catalog_unavailable')
        catalogRef.current = snap.data
        let refs = [] as ReturnType<typeof parseCartReferences>
        try {
          const timestamp = Number(localStorage.getItem(STORAGE_UPDATED_AT))
          if (!timestamp || Date.now() - timestamp < CART_TTL_MS) {
            refs = parseCartReferences(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'))
          }
        } catch { /* Discard malformed legacy storage. */ }
        const next = resolveCart(refs, snap.data)
        save(next)
        setCartReady(true)
        if (JSON.stringify(refs) !== JSON.stringify(cartReferences(next))) {
          toastRef.current('info', 'Actualizamos la bolsa según el stock disponible.')
        }
      } catch {
        if (!cancelled) toastRef.current('warning', 'No pudimos actualizar la bolsa. Recargá la página para reintentar.')
      }
    })()
    return () => { cancelled = true }
  }, [save])

  /** Changed quotes require the customer to review and confirm again. */
  const refreshCarrito = useCallback(async (): Promise<boolean> => {
    try {
      const snap = await fetchPublicCatalogSnapshot(getBrowserSupabase())
      if (!snap.ok) throw new Error('catalog_unavailable')
      catalogRef.current = snap.data
      const previous = cartRef.current
      const next = resolveCart(cartReferences(previous), snap.data)
      save(next)
      setCartReady(true)
      if (cartQuote(previous) !== cartQuote(next)) {
        toastRef.current('warning', 'Cambió el precio o stock de tu bolsa. Revisá el total y volvé a confirmar.')
        return false
      }
      return next.length > 0
    } catch {
      toastRef.current('error', 'No pudimos verificar precio y stock. Intentá nuevamente.')
      return false
    }
  }, [save])

  const change = useCallback((kind: 'product' | 'combo', id: number, delta: number) => {
    const catalog = catalogRef.current
    if (!catalog) { toastRef.current('info', 'Estamos actualizando la bolsa. Intentá nuevamente en unos segundos.'); return }
    const refs = cartReferences(cartRef.current)
    const existing = refs.find(r => r.kind === kind && r.id === id)
    if (existing) existing.quantity += delta
    else if (delta > 0) refs.push({ kind, id, quantity: delta })
    const valid = refs.filter(r => r.quantity > 0)
    const next = resolveCart(valid, catalog)
    if (delta > 0 && cartReferences(cartRef.current).some(previous =>
      (previous.kind !== kind || previous.id !== id) &&
      (cartReferences(next).find(r => r.kind === previous.kind && r.id === previous.id)?.quantity ?? 0) < previous.quantity)) {
      toastRef.current('warning', 'Ese stock ya está incluido en otros productos o combos de tu bolsa.')
      return
    }
    const actual = cartReferences(next).find(r => r.kind === kind && r.id === id)?.quantity ?? 0
    const wanted = valid.find(r => r.kind === kind && r.id === id)?.quantity ?? 0
    save(next)
    if (actual < wanted) toastRef.current('warning', 'Stock máximo alcanzado; revisá las cantidades de la bolsa.')
    else toastRef.current(delta > 0 ? 'success' : 'info', delta > 0 ? 'Agregado a tu bolsa' : 'Bolsa actualizada')
    setBadgeAnimado(delta > 0)
  }, [save])

  useEffect(() => {
    if (!badgeAnimado) return
    const timer = setTimeout(() => setBadgeAnimado(false), 500)
    return () => clearTimeout(timer)
  }, [badgeAnimado])

  const agregarAlCarrito = useCallback((p: PublicCatalogProduct, qty = 1) => change('product', p.id, qty), [change])
  const agregarComboAlCarrito = useCallback((c: PublicCatalogCombo) => change('combo', c.id, 1), [change])
  const actualizarCantidad = useCallback((id: number, delta: number) => change('product', id, delta), [change])
  const actualizarCantidadCombo = useCallback((id: number, delta: number) => change('combo', id, delta), [change])
  const quitarDelCarrito = useCallback((id: number) => save(cartRef.current.filter(i => i.producto?.id !== id)), [save])
  const quitarComboDelCarrito = useCallback((id: number) => save(cartRef.current.filter(i => i.combo?.id !== id)), [save])
  const clearCarrito = useCallback(() => save([]), [save])
  return { carrito, cartReady, refreshCarrito, agregarAlCarrito, agregarComboAlCarrito, actualizarCantidad,
    actualizarCantidadCombo, quitarDelCarrito, quitarComboDelCarrito, clearCarrito, badgeAnimado }
}
