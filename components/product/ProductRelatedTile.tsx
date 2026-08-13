import Link from 'next/link'
import Image from 'next/image'
import { Sparkles } from 'lucide-react'
import { getProductImages } from '@/lib/supabase'
import type { PublicCatalogProduct } from '@/lib/domain/catalog/publicDto'
import { formatPesoAR } from '@/lib/formatPesoAR'

type Props = {
  product: PublicCatalogProduct
  /** Precio final ya con descuento de catálogo */
  displayPrice: number
}

/**
 * Mini-ficha para “También te puede interesar”.
 * Imagen con width/height (sin fill) para evitar colapso si falla aspect-ratio en Tailwind.
 */
export function ProductRelatedTile({ product, displayPrice }: Props) {
  const imgs = getProductImages(product)
  const src = imgs[0]

  return (
    <Link
      href={`/catalogo/p/${product.id}`}
      className="ilara-pdp-surface group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-pink-100 bg-white shadow-sm transition hover:border-pink-200 hover:shadow-md dark:hover:border-pink-400/25"
    >
      <div className="relative aspect-square w-full min-h-[100px] bg-zinc-100 dark:bg-zinc-900">
        {src ? (
          <Image
            src={src}
            alt={product.name}
            width={400}
            height={400}
            className="h-full w-full object-cover"
            sizes="(max-width: 640px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full min-h-[100px] w-full items-center justify-center">
            <Sparkles className="h-10 w-10 text-pink-200 dark:text-pink-500/40" aria-hidden />
          </div>
        )}
      </div>
      <div className="flex min-h-[5rem] flex-col gap-1.5 px-3 py-3 sm:px-4 sm:py-4">
        <span className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 group-hover:text-pink-600 dark:text-zinc-100 dark:group-hover:text-pink-300 sm:text-[0.9375rem]">
          {product.name}
        </span>
        <span className="mt-auto text-base font-extrabold tabular-nums text-gray-900 dark:text-zinc-50 sm:text-lg">
          ${formatPesoAR(displayPrice)}
        </span>
      </div>
    </Link>
  )
}
