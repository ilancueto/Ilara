'use client'

import { useMemo, useCallback } from 'react'
import type { PublicCatalogCombo, PublicCatalogProduct } from '@/lib/domain/catalog/publicDto'
import { catalogDisplayUnitPrice } from '@/lib/domain/payments/catalogDisplayPrice'
import { deriveCatalogListing } from '@/lib/domain/catalog/deriveCatalogListing'

function getPrecioConDescuento(producto: PublicCatalogProduct): number {
  return catalogDisplayUnitPrice(producto)
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
  const listing = useMemo(
    () => deriveCatalogListing({
      productos,
      combos,
      ventasPorProducto,
      view: {
        q: busqueda,
        cat: categoriaFiltro,
        sort: ordenamiento,
        page: paginaActual,
        min: precioMin,
        max: precioMax,
      },
    }),
    [
      productos,
      combos,
      ventasPorProducto,
      busqueda,
      categoriaFiltro,
      ordenamiento,
      paginaActual,
      precioMin,
      precioMax,
    ]
  )

  const {
    productosFiltrados,
    combosFiltrados,
    combosOrdenados,
    itemsDestacados,
    totalItems,
    totalPaginas,
    itemsPagina,
  } = listing

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
