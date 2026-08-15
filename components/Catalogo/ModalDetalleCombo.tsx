'use client'

import { useRef } from 'react'
import { getProductImages } from '@/lib/supabase'
import type { PublicCatalogCombo, PublicCatalogProduct } from '@/lib/domain/catalog/publicDto'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import Image from 'next/image'
import { X, Package, Sparkles } from 'lucide-react'

interface ModalDetalleComboProps {
  combo: PublicCatalogCombo
  onClose: () => void
  onAgregar: () => void
  disponible: boolean
}

export function ModalDetalleCombo({ combo, onClose, onAgregar, disponible }: ModalDetalleComboProps) {
  const items = combo.combo_items || []
  const panelRef = useRef<HTMLDivElement>(null)
  useDialogA11y(true, onClose, panelRef)

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="combo-detail-title"
        className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl dark:shadow-none border border-gray-100 dark:border-gray-600 overflow-hidden animate-fade-in-scale outline-none"
      >
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-br from-amber-50 to-orange-50/80 dark:from-amber-900/20 dark:to-orange-900/20 border-b border-amber-100/80 dark:border-gray-600">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-xl text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white/80 dark:hover:bg-gray-700 transition-colors" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-300/40 dark:shadow-amber-900/30">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Combo</span>
              <h2 id="combo-detail-title" className="text-xl font-extrabold text-gray-900 dark:text-gray-100">{combo.name}</h2>
            </div>
          </div>
          {combo.description && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{combo.description}</p>}
          <p className="mt-3 text-2xl font-extrabold text-gray-900 dark:text-gray-100 tabular-nums">${combo.sale_price.toLocaleString()}</p>
        </div>
        <div className="p-5 sm:p-6">
          <h3 className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            Productos incluidos
          </h3>
          <div className="space-y-2.5">
            {items.map((ci, idx) => {
              const prod = ci.products as PublicCatalogProduct | undefined
              const nombre = prod?.name ?? 'Producto incluido'
              const img = prod ? getProductImages(prod)[0] : undefined
              return (
                <div key={ci.id ?? idx} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/80 dark:bg-gray-700/60 border border-gray-100 dark:border-gray-600">
                  <div className="w-11 h-11 rounded-lg overflow-hidden bg-white dark:bg-gray-600 border border-gray-100 dark:border-gray-500 flex-shrink-0 flex items-center justify-center">
                    {img ? (
                      <Image src={img} alt={nombre} width={44} height={44} className="w-full h-full object-cover" />
                    ) : (
                      <Sparkles className="w-5 h-5 text-amber-200 dark:text-amber-500/70" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 dark:text-gray-100 truncate text-sm">{nombre}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Cantidad: {ci.quantity}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="p-5 sm:p-6 pt-0">
          <button
            onClick={() => { if (disponible) { onAgregar(); onClose() } }}
            disabled={!disponible}
            className="w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-amber-300/30 dark:shadow-amber-900/30 transition-all"
          >
            {disponible ? 'Agregar al carrito' : 'Agotado'}
          </button>
        </div>
      </div>
    </div>
  )
}
