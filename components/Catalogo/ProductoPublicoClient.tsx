'use client'

import { useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Producto, getProductImages } from '@/lib/supabase'
import { priceWithProductDiscount } from '@/lib/catalogPricing'
import { WHATSAPP_NUMBER } from '@/lib/config'
import { useCarrito } from '@/hooks/useCarrito'
import { useToast } from '@/context/ToastContext'
import ThemeSwitch from '@/components/ThemeSwitch'
import { PastelCard } from '@/components/ui/PastelCard'
import { ChevronLeft, Share2, ShoppingBag, Sparkles } from 'lucide-react'

type Props = {
  producto: Producto
  canonicalPath: string
}

export function ProductoPublicoClient({ producto, canonicalPath }: Props) {
  const { showToast: baseShowToast } = useToast()
  const showToast = useCallback(
    (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
      baseShowToast(type, message, 4000)
    },
    [baseShowToast]
  )
  const { carrito, agregarAlCarrito, clearCarrito } = useCarrito(showToast)

  const images = getProductImages(producto)
  const main = images[0]
  const precio = priceWithProductDiscount(producto.sale_price, producto.discount_percentage)
  const site =
    typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.host}`
      : ''
  const urlProducto = `${site}${canonicalPath}`

  const compartir = () => {
    const texto = `¡Mirá este producto!%0A%0A*${encodeURIComponent(producto.name)}*%0A${producto.brand ? encodeURIComponent(producto.brand) + '%0A' : ''}Precio: $${precio.toLocaleString()}%0A%0A${encodeURIComponent(urlProducto)}`
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${texto}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-pink-50/30 via-white to-pink-50/20 dark:from-[#08080b] dark:via-[#060609] dark:to-[#08080b]">
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#08080b]/80 backdrop-blur-md border-b border-pink-100/40 dark:border-gray-800/30">
        <div className="w-full px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          <Link
            href="/catalogo"
            className="inline-flex items-center gap-2 text-sm font-semibold text-pink-600 dark:text-pink-400 hover:underline min-w-0"
          >
            <ChevronLeft className="w-5 h-5 shrink-0" />
            <span className="truncate">Catálogo</span>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeSwitch />
            <Link
              href="/login"
              className="px-3 py-2 rounded-xl border border-pink-100 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-semibold text-sm"
            >
              Login
            </Link>
          </div>
        </div>
      </header>

      <main className="w-full max-w-lg mx-auto px-4 sm:px-6 py-8 pb-24">
        <PastelCard className="overflow-hidden" noHover role="region" aria-label={producto.name}>
          <div className="relative aspect-square bg-gray-50 dark:bg-gray-800">
            {main ? (
              <Image
                src={main}
                alt={producto.name}
                fill
                className="object-cover"
                sizes="(max-width: 512px) 100vw, 512px"
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Sparkles className="w-20 h-20 text-pink-200 dark:text-pink-500/50" />
              </div>
            )}
            <button
              type="button"
              onClick={compartir}
              className="absolute top-4 right-4 p-2.5 rounded-xl bg-white/90 text-gray-600 shadow-md hover:text-pink-600"
              aria-label={`Compartir ${producto.name}`}
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            {producto.categories?.name && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-pink-500 dark:text-pink-400">
                {producto.categories.name}
              </p>
            )}
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 leading-tight">{producto.name}</h1>
            {producto.brand && <p className="text-sm text-gray-500 dark:text-gray-400">{producto.brand}</p>}
            {(producto.discount_percentage ?? 0) > 0 ? (
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm text-gray-400 line-through">${producto.sale_price.toLocaleString()}</span>
                <span className="text-3xl font-extrabold text-gray-900 dark:text-white tabular-nums">${precio.toLocaleString()}</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">-{producto.discount_percentage}%</span>
              </div>
            ) : (
              <p className="text-3xl font-extrabold text-gray-900 dark:text-white tabular-nums">${precio.toLocaleString()}</p>
            )}
            {producto.notes && (
              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{producto.notes}</p>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {producto.stock > 0 ? `${producto.stock} disponibles` : 'Sin stock'}
            </p>
            <button
              type="button"
              disabled={producto.stock <= 0}
              onClick={() => agregarAlCarrito(producto)}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {producto.stock <= 0 ? 'Agotado' : 'Agregar al carrito'}
            </button>
          </div>
        </PastelCard>
      </main>

      {carrito.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-50 p-4 bg-white/95 dark:bg-gray-900/95 border-t border-pink-100 dark:border-gray-700 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">
            {carrito.length} ítem{carrito.length !== 1 ? 's' : ''} en el carrito
          </span>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => clearCarrito()}
              className="px-3 py-2 text-sm font-semibold text-gray-500 hover:text-red-600"
            >
              Vaciar
            </button>
            <Link
              href="/catalogo"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-pink-500 text-white font-bold text-sm"
            >
              <ShoppingBag className="w-4 h-4" />
              Ir al catálogo
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
