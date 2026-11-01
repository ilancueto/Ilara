import type { PublicCatalogCombo, PublicCatalogProduct } from './publicDto'
import { catalogDisplayComboPrice, catalogDisplayUnitPrice } from '../payments/catalogDisplayPrice'
import { getProductImages } from '@/lib/domain/images'

type CatalogItem = PublicCatalogProduct | PublicCatalogCombo
export const normalizeCatalogSearch = (value: string) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
export const catalogItemPrice = (item: CatalogItem) => 'stock' in item ? catalogDisplayUnitPrice(item) : catalogDisplayComboPrice(item)

function hasCatalogImage(item: CatalogItem): boolean {
  if ('stock' in item) return getProductImages(item).length > 0
  if (item.image_url?.trim()) return true
  for (const row of item.combo_items || []) {
    if (row.products && getProductImages(row.products).length > 0) return true
  }
  return false
}

export function sortCatalogItems(items: CatalogItem[], order: string, sales: Map<number, number>): CatalogItem[] {
  const sold = (item: CatalogItem) => 'stock' in item ? sales.get(item.id) ?? 0 : 0
  return [...items].sort((a, b) => {
    let comparison = 0
    switch (order) {
      case 'precio-asc': comparison = catalogItemPrice(a) - catalogItemPrice(b); break
      case 'precio-desc': comparison = catalogItemPrice(b) - catalogItemPrice(a); break
      case 'nuevo-desc': comparison = Date.parse(b.created_at) - Date.parse(a.created_at); break
      case 'nuevo-asc': comparison = Date.parse(a.created_at) - Date.parse(b.created_at); break
      case 'nombre-desc': comparison = b.name.localeCompare(a.name, 'es'); break
      // No combo sales aggregate exists: rank them with zero sales, without a pinned group.
      case 'vendidos-desc': comparison = sold(b) - sold(a); break
      default: comparison = a.name.localeCompare(b.name, 'es'); break
    }
    if (comparison !== 0) return comparison
    // Prefer items with a real photo when the primary key ties (incl. zero sales).
    const img = Number(hasCatalogImage(b)) - Number(hasCatalogImage(a))
    if (img !== 0) return img
    return a.name.localeCompare(b.name, 'es') || a.id - b.id
  })
}
