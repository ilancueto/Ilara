import type { ProductImageSource } from '@/lib/domain/types'

/** Devuelve la lista de imágenes (image_urls o [image_url] o []). */
export function getProductImages(p: ProductImageSource): string[] {
  if (p.image_urls?.length) return p.image_urls
  if (p.image_url) return [p.image_url]
  return []
}
