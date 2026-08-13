import 'server-only'

/**
 * DAL catálogo público (servidor). Reexporta lecturas ISR-safe.
 * Autorización: RLS anon + grants column-level Stage 0.
 */
export {
  fetchCatalogProductsServer,
  fetchCatalogCombosServer,
  fetchCatalogCategoriesServer,
  fetchCatalogProductByIdServer,
  fetchCatalogRelatedProductsServer,
  type CatalogQueryResult,
  type CatalogProductByIdResult,
} from '@/lib/catalog/serverCatalog'

export type {
  PublicCatalogProduct,
  PublicCatalogCombo,
  PublicCatalogCategory,
} from '@/lib/domain/catalog/publicDto'
