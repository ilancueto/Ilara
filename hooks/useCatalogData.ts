'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, type Producto, type Categoria, type ComboConItems } from '@/lib/supabase'

/**
 * Carga inicial de productos, combos y categorías del catálogo público,
 * más agregado de unidades vendidas por producto cuando el orden es "más vendidos".
 */
export function useCatalogData(ordenamiento: string) {
    const [productos, setProductos] = useState<Producto[]>([])
    const [combos, setCombos] = useState<ComboConItems[]>([])
    const [categorias, setCategorias] = useState<Categoria[]>([])
    const [cargando, setCargando] = useState(true)
    const [ventasPorProducto, setVentasPorProducto] = useState<Map<number, number>>(new Map())

    const obtenerProductos = useCallback(async () => {
        setCargando(true)
        const { data } = await supabase
            .from('products')
            .select('*, categories(name)')
            .gte('stock', 0)
            .or('visible_in_catalog.eq.true,visible_in_catalog.is.null')
            .order('created_at', { ascending: false })
        if (data) setProductos(data)
        setCargando(false)
    }, [])

    const obtenerCombos = useCallback(async () => {
        const { data } = await supabase
            .from('combos')
            .select(`
                *,
                combo_items (id, product_id, quantity, products (*))
            `)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
        if (data) setCombos(data as ComboConItems[])
    }, [])

    const obtenerCategorias = useCallback(async () => {
        const { data } = await supabase
            .from('categories')
            .select('*')
            .order('name')
        if (data) setCategorias(data)
    }, [])

    /* eslint-disable react-hooks/set-state-in-effect -- initial data load on mount */
    useEffect(() => {
        obtenerProductos()
        obtenerCombos()
        obtenerCategorias()
    }, [obtenerProductos, obtenerCombos, obtenerCategorias])
    /* eslint-enable react-hooks/set-state-in-effect */

    useEffect(() => {
        if (ordenamiento !== 'vendidos-desc') return
        const fetchVentas = async () => {
            const { data } = await supabase
                .from('sale_items')
                .select('product_id, quantity')
                .not('product_id', 'is', null)
            const map = new Map<number, number>()
            for (const row of data || []) {
                const id = row.product_id as number
                map.set(id, (map.get(id) ?? 0) + (row.quantity ?? 0))
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
        ventasPorProducto,
        obtenerProductos,
        obtenerCombos,
        obtenerCategorias,
    }
}
