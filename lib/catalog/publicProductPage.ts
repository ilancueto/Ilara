import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import 'server-only'
import { createSupabasePublicClient } from '@/lib/supabase/public'
import {
  applyCatalogPricing,
  fetchCatalogProductByIdServer,
  fetchPublicPricingContextServer,
} from '@/lib/catalog/serverCatalog'
import type { PublicCatalogProduct } from '@/lib/domain/catalog/publicDto'
import type { PublicPricingContext } from '@/lib/domain/payments/types'
import { isLocalProductProviderFault } from '@/lib/catalog/localSeoFault'
import {
  isProductProviderUnavailableError,
  ProductProviderUnavailableError,
} from '@/lib/catalog/productProviderError'
export { parsePublicProductId } from '@/lib/catalog/parsePublicProductId'

export type PublicProductPageData =
  | { status: 'ok'; product: PublicCatalogProduct; pricing: PublicPricingContext }
  | { status: 'not_found' }
  | { status: 'error' }

type CachedProductPageData = Exclude<PublicProductPageData, { status: 'error' }>

/**
 * Consulta cacheada 120s. Un error del proveedor se lanza (no se guarda).
 * `not_found` = consulta ok y el producto no es público.
 */
async function fetchPublicProductPageUncached(id: number): Promise<CachedProductPageData> {
  const supabase = createSupabasePublicClient()
  const [res, pricing] = await Promise.all([
    fetchCatalogProductByIdServer(supabase, id),
    fetchPublicPricingContextServer(supabase),
  ])
  if (res.status === 'error') throw new ProductProviderUnavailableError()
  if (res.status === 'not_found') return { status: 'not_found' }
  return { status: 'ok', product: applyCatalogPricing(res.product, pricing), pricing }
}

const loadCachedPublicProductPage = unstable_cache(
  fetchPublicProductPageUncached,
  ['public-product-page'],
  { revalidate: 120, tags: ['catalog-product'] }
)

/**
 * Una lectura por request para metadata y página.
 * El fallo local de prueba no pasa por la caché de datos (no se guarda como ausencia).
 */
export const loadPublicProductPage = cache(async (id: number): Promise<PublicProductPageData> => {
  if (isLocalProductProviderFault(id)) return { status: 'error' }
  try {
    return await loadCachedPublicProductPage(id)
  } catch (err) {
    if (isProductProviderUnavailableError(err)) return { status: 'error' }
    throw err
  }
})
