'use client'

import { useMemo, useCallback } from 'react'
import type { PublicCatalogCombo, PublicCatalogProduct } from '@/lib/domain/catalog/publicDto'
import { priceWithProductDiscount } from '@/lib/catalogPricing'
import { PRODUCTOS_POR_PAGINA } from '@/components/Catalogo/catalogConstants'

function getPrecioConDescuento(producto: PublicCatalogProduct): number {
  return priceWithProductDiscount(producto.sale_price, producto.discount_percentage)
}

export type CatalogDerivedListsParams = {
  productos: PublicCatalogProduct[]
  combos: PublicCatalogCombo[]
  ventasPorProducto: Map<number, number>
  categoriaFiltro: string
  busqueda: string
  precioMin: number
  precioMax: number
  ordenamiento: string
  paginaActual: number
}

/**
 * Filtrado, orden y paginación del catálogo público (productos + combos en una lista unificada).
 */
export function useCatalogDerivedLists({
  productos,
  combos,
  ventasPorProducto,
  categoriaFiltro,
  busqueda,
  precioMin,
  precioMax,
  ordenamiento,
  paginaActual,
}: CatalogDerivedListsParams) {
  const productosFiltrados = useMemo(() => {
    return productos
      .filter((p) => {
        if (categoriaFiltro !== 'all' && p.category_id?.toString() !== categoriaFiltro) return false
        if (busqueda) {
          const termino = busqueda.toLowerCase()
          if (!p.name.toLowerCase().includes(termino) && !p.brand?.toLowerCase().includes(termino))
            return false
        }
        const precioProd = getPrecioConDescuento(p)
        if (precioProd < precioMin || precioProd > precioMax) return false
        return true
      })
      .sort((a, b) => {
        if (a.stock === 0 && b.stock !== 0) return 1
        if (a.stock !== 0 && b.stock === 0) return -1
        const precioA = getPrecioConDescuento(a)
        const precioB = getPrecioConDescuento(b)
        switch (ordenamiento) {
          case 'precio-asc':
            return precioA - precioB
          case 'precio-desc':
            return precioB - precioA
          case 'nombre-desc':
            return b.name.localeCompare(a.name)
          case 'nuevo-desc':
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          case 'nuevo-asc':
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          case 'vendidos-desc':
            return (ventasPorProducto.get(b.id) ?? 0) - (ventasPorProducto.get(a.id) ?? 0)
          default:
            return a.name.localeCompare(b.name)
        }
      })
  }, [
    productos,
    categoriaFiltro,
    busqueda,
    precioMin,
    precioMax,
    ordenamiento,
    ventasPorProducto,
  ])

  const combosFiltrados = useMemo(() => {
    return combos.filter((c) => {
      if (categoriaFiltro !== 'all') return false
      if (busqueda) {
        const t = busqueda.toLowerCase()
        if (!c.name.toLowerCase().includes(t) && !(c.description || '').toLowerCase().includes(t))
          return false
      }
      if (c.sale_price < precioMin || c.sale_price > precioMax) return false
      return true
    })
  }, [combos, categoriaFiltro, busqueda, precioMin, precioMax])

  const combosOrdenados = useMemo(() => {
    return [...combosFiltrados].sort((a, b) => {
      if (ordenamiento === 'precio-asc') return a.sale_price - b.sale_price
      if (ordenamiento === 'precio-desc') return b.sale_price - a.sale_price
      if (ordenamiento === 'nombre-desc') return b.name.localeCompare(a.name)
      if (ordenamiento === 'nuevo-desc')
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (ordenamiento === 'nuevo-asc')
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return a.name.localeCompare(b.name)
    })
  }, [combosFiltrados, ordenamiento])

  const itemsDestacados = useMemo(
    () => [...combosOrdenados, ...productosFiltrados],
    [combosOrdenados, productosFiltrados]
  )

  const totalItems = itemsDestacados.length
  const totalPaginas = Math.max(1, Math.ceil(totalItems / PRODUCTOS_POR_PAGINA))
  const itemsPagina = useMemo(() => {
    const inicio = (paginaActual - 1) * PRODUCTOS_POR_PAGINA
    return itemsDestacados.slice(inicio, inicio + PRODUCTOS_POR_PAGINA)
  }, [itemsDestacados, paginaActual])

  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos])

  const comboDisponible = useCallback(
    (combo: PublicCatalogCombo) => {
      const items = combo.combo_items || []
      if (items.length === 0) return false
      for (const ci of items) {
        const prod = porId.get(ci.product_id)
        if (!prod || prod.stock < ci.quantity) return false
      }
      return true
    },
    [porId]
  )

  return {
    productosFiltrados,
    combosFiltrados,
    combosOrdenados,
    itemsDestacados,
    totalItems,
    totalPaginas,
    itemsPagina,
    comboDisponible,
    getPrecioConDescuento,
  }
}
