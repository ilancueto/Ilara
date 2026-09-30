import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import 'server-only'
import { createSupabasePublicClient } from '@/lib/supabase/public'
import {
  applyCatalogPricing,
  fetchCatalogCategoriesServer,
  fetchCatalogCombosServer,
  fetchCatalogProductsServer,
  fetchPublicPricingContextServer,
} from '@/lib/catalog/serverCatalog'
import type { PublicCatalogCategory, PublicCatalogCombo, PublicCatalogProduct } from '@/lib/domain/catalog/publicDto'
import { readAllCatalogRows } from '@/lib/domain/catalog/readAllRows'

const getCachedCatalogSales = unstable_cache(async (): Promise<Array<[number, number]>> => {
  const client = createSupabasePublicClient()
  const { data, error } = await readAllCatalogRows((from, to) => client.rpc('catalog_sales_by_product', {}, { count: 'exact' }).order('product_id').range(from, to))
  if (error) throw new Error('public-catalog-sales-failed')
  return (data ?? []).map((row) => {
    const value = row as { product_id: number; units_sold: number }
    return [Number(value.product_id), Number(value.units_sold)] as [number, number]
  })
}, ['public-catalog-sales'], { revalidate: 60, tags: ['catalog'] })

export const loadPublicCatalogSales = cache(getCachedCatalogSales)

export type PublicCatalogSnapshot = {
  productos: PublicCatalogProduct[]
  combos: PublicCatalogCombo[]
  categorias: PublicCatalogCategory[]
  serverFetchFailed: boolean
}

async function fetchPublicCatalogSnapshotUncached(): Promise<PublicCatalogSnapshot> {
  const supabase = createSupabasePublicClient()
  const [pr, co, ca, pricing] = await Promise.all([
    fetchCatalogProductsServer(supabase),
    fetchCatalogCombosServer(supabase),
    fetchCatalogCategoriesServer(supabase),
    fetchPublicPricingContextServer(supabase),
  ])
  if (!pr.ok || !co.ok || !ca.ok) {
    throw new Error('public-catalog-snapshot-failed')
  }
  return {
    productos: pr.data.map((item) => applyCatalogPricing(item, pricing)),
    combos: co.data.map((item) => applyCatalogPricing(item, pricing)),
    categorias: ca.data,
    serverFetchFailed: false,
  }
}

/**
 * Snapshot del catálogo, independiente de searchParams.
 * El HTML de cada consulta se renderiza en request; no se mezcla bajo una sola clave de página.
 * Un fallo no se cachea: la siguiente petición vuelve a consultar.
 */
const getCachedPublicCatalogSnapshot = unstable_cache(
  fetchPublicCatalogSnapshotUncached,
  ['public-catalog-snapshot'],
  { revalidate: 60, tags: ['catalog'] }
)

export const loadPublicCatalogSnapshot = cache(async (): Promise<PublicCatalogSnapshot> => {
  try {
    return await getCachedPublicCatalogSnapshot()
  } catch {
    return {
      productos: [],
      combos: [],
      categorias: [],
      serverFetchFailed: true,
    }
  }
})
