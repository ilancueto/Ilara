'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, type Producto, type Categoria, type ComboConItems } from '@/lib/supabase'
import {
    CATALOG_CATEGORY_SELECT,
    CATALOG_COMBO_SELECT,
    CATALOG_PRODUCT_SELECT,
} from '@/lib/catalog/publicCatalogSelect'

/** Rellena campos internos no devueltos por el DTO público. */
function asCatalogProducto(row: unknown): Producto {
    const r = row as Producto
    return {
        ...r,
        purchase_price: r.purchase_price ?? null,
        min_stock: r.min_stock ?? 0,
        notes: r.notes ?? null,
        updated_at: r.updated_at ?? r.created_at,
    }
}

function asCatalogProductos(rows: unknown[] | null | undefined): Producto[] {
    return (rows ?? []).map(asCatalogProducto)
}

function asCatalogCombos(rows: unknown[] | null | undefined): ComboConItems[] {
    return (rows ?? []).map((raw) => {
        const r = raw as ComboConItems
        return {
            ...r,
            updated_at: r.updated_at ?? r.created_at,
            combo_items: (r.combo_items ?? []).map((item) => ({
                ...item,
                products: item.products ? asCatalogProducto(item.products) : undefined,
            })),
        }
    })
}

export type CatalogInitialSnapshot = {
    productos: Producto[]
    combos: ComboConItems[]
    categorias: Categoria[]
    /** Fallo SSR: reintentar carga en el cliente */
    serverFetchFailed?: boolean
}

/**
 * Carga productos, combos y categorías del catálogo público.
 * Si `initial` viene del servidor (SSR/ISR), no repite el fetch inicial en el cliente.
 */
export function useCatalogData(ordenamiento: string, initial: CatalogInitialSnapshot | null = null) {
    const [productos, setProductos] = useState<Producto[]>(initial?.productos ?? [])
    const [combos, setCombos] = useState<ComboConItems[]>(initial?.combos ?? [])
    const [categorias, setCategorias] = useState<Categoria[]>(initial?.categorias ?? [])
    const [cargando, setCargando] = useState(!initial || Boolean(initial.serverFetchFailed))
    const [catalogLoadError, setCatalogLoadError] = useState(false)
    const [ventasPorProducto, setVentasPorProducto] = useState<Map<number, number>>(new Map())

    const obtenerProductos = useCallback(async () => {
        const { data } = await supabase
            .from('products')
            .select(CATALOG_PRODUCT_SELECT)
            .gte('stock', 0)
            .or('visible_in_catalog.eq.true,visible_in_catalog.is.null')
            .order('created_at', { ascending: false })
        if (data) setProductos(asCatalogProductos(data))
    }, [])

    const obtenerCombos = useCallback(async () => {
        const { data } = await supabase
            .from('combos')
            .select(CATALOG_COMBO_SELECT)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
        if (data) setCombos(asCatalogCombos(data))
    }, [])

    const obtenerCategorias = useCallback(async () => {
        const { data } = await supabase.from('categories').select(CATALOG_CATEGORY_SELECT).order('name')
        if (data) setCategorias(data as Categoria[])
    }, [])

    const cargarDesdeCliente = useCallback(async () => {
        const [pr, co, ca] = await Promise.all([
            supabase
                .from('products')
                .select(CATALOG_PRODUCT_SELECT)
                .gte('stock', 0)
                .or('visible_in_catalog.eq.true,visible_in_catalog.is.null')
                .order('created_at', { ascending: false }),
            supabase
                .from('combos')
                .select(CATALOG_COMBO_SELECT)
                .eq('is_active', true)
                .order('created_at', { ascending: false }),
            supabase.from('categories').select(CATALOG_CATEGORY_SELECT).order('name'),
        ])
        if (pr.error || co.error || ca.error) {
            setCatalogLoadError(true)
            return false
        }
        setCatalogLoadError(false)
        if (pr.data) setProductos(asCatalogProductos(pr.data))
        if (co.data) setCombos(asCatalogCombos(co.data))
        if (ca.data) setCategorias(ca.data as Categoria[])
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
            const { data, error } = await supabase.rpc('catalog_sales_by_product')
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
