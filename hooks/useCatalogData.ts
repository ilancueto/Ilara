'use client'

import { useState, useEffect, useCallback } from 'react'
import { getBrowserSupabase } from '@/lib/supabase/browser'
import {
  type PublicCatalogCategory,
  type PublicCatalogCombo,
  type PublicCatalogProduct,
} from '@/lib/domain/catalog/publicDto'
import { fetchPublicCatalogSnapshot } from '@/lib/domain/catalog/publicQueries'

export type CatalogInitialSnapshot = {
  productos: PublicCatalogProduct[]
  combos: PublicCatalogCombo[]
  categorias: PublicCatalogCategory[]
  /** Fallo SSR: reintentar carga en el cliente */
  serverFetchFailed?: boolean
}

/**
 * Carga productos, combos y categorías del catálogo público (DTO Stage 5).
 * Si `initial` viene del servidor (SSR/ISR), no repite el fetch inicial en el cliente.
 */
export function useCatalogData(ordenamiento: string, initial: CatalogInitialSnapshot | null = null) {
  const [productos, setProductos] = useState<PublicCatalogProduct[]>(initial?.productos ?? [])
  const [combos, setCombos] = useState<PublicCatalogCombo[]>(initial?.combos ?? [])
  const [categorias, setCategorias] = useState<PublicCatalogCategory[]>(initial?.categorias ?? [])
  const [cargando, setCargando] = useState(!initial || Boolean(initial.serverFetchFailed))
  const [catalogLoadError, setCatalogLoadError] = useState(false)
  const [ventasPorProducto, setVentasPorProducto] = useState<Map<number, number>>(new Map())

  const obtenerProductos = useCallback(async () => {
    const snap = await fetchPublicCatalogSnapshot(getBrowserSupabase())
    if (snap.ok) setProductos(snap.data.productos)
  }, [])

  const obtenerCombos = useCallback(async () => {
    const snap = await fetchPublicCatalogSnapshot(getBrowserSupabase())
    if (snap.ok) setCombos(snap.data.combos)
  }, [])

  const obtenerCategorias = useCallback(async () => {
    const snap = await fetchPublicCatalogSnapshot(getBrowserSupabase())
    if (snap.ok) setCategorias(snap.data.categorias)
  }, [])

  const cargarDesdeCliente = useCallback(async () => {
    const snap = await fetchPublicCatalogSnapshot(getBrowserSupabase())
    if (!snap.ok) {
      setCatalogLoadError(true)
      return false
    }
    setCatalogLoadError(false)
    setProductos(snap.data.productos)
    setCombos(snap.data.combos)
    setCategorias(snap.data.categorias)
    return true
  }, [])

  const recargarCatalogo = useCallback(async () => {
    setCatalogLoadError(false)
    setCargando(true)
    try {
      await cargarDesdeCliente()
    } finally {
      setCargando(false)
    }
  }, [cargarDesdeCliente])

  const debeCargarEnCliente = initial == null || Boolean(initial?.serverFetchFailed)

  useEffect(() => {
    if (!debeCargarEnCliente) return
    let cancelled = false
    void (async () => {
      setCargando(true)
      try {
        const ok = await cargarDesdeCliente()
        if (cancelled) return
        if (!ok) return
      } finally {
        if (!cancelled) setCargando(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [debeCargarEnCliente, cargarDesdeCliente])

  useEffect(() => {
    if (ordenamiento !== 'vendidos-desc') return
    const fetchVentas = async () => {
      const { data, error } = await getBrowserSupabase().rpc('catalog_sales_by_product')
      const map = new Map<number, number>()
      if (error) {
        console.warn('[catálogo] catalog_sales_by_product:', error.message)
        setVentasPorProducto(map)
        return
      }
      for (const row of data || []) {
        const r = row as { product_id: number; units_sold: number }
        map.set(Number(r.product_id), Number(r.units_sold))
      }
      setVentasPorProducto(map)
    }
    void fetchVentas()
  }, [ordenamiento])

  return {
    productos,
    combos,
    categorias,
    cargando,
    catalogLoadError,
    recargarCatalogo,
    ventasPorProducto,
    obtenerProductos,
    obtenerCombos,
    obtenerCategorias,
  }
}
