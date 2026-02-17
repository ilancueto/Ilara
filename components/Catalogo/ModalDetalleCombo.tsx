'use client'

import { ComboConItems, Producto } from '@/lib/supabase'
import Image from 'next/image'
import { X, Package, Sparkles } from 'lucide-react'

interface ModalDetalleComboProps {
  combo: ComboConItems
  onClose: () => void
  onAgregar: () => void
  disponible: boolean
}

export function ModalDetalleCombo({ combo, onClose, onAgregar, disponible }: ModalDetalleComboProps) {
  const items = combo.combo_items || []

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="combo-detail-title">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-in-scale">
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-br from-amber-50 to-orange-50/80 border-b border-amber-100/80">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-white/80 transition-colors" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-300/40">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Combo</span>
              <h2 id="combo-detail-title" className="text-xl font-extrabold text-gray-900">{combo.name}</h2>
            </div>
          </div>
          {combo.description && <p className="mt-2 text-sm text-gray-600">{combo.description}</p>}
          <p className="mt-3 text-2xl font-extrabold text-gray-900">${combo.sale_price.toLocaleString()}</p>
        </div>
        <div className="p-6">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Productos incluidos
          </h3>
          <div className="space-y-3">
            {items.map((ci, idx) => {
              const prod = ci.products as Producto | undefined
              const nombre = prod?.name ?? `Producto #${ci.product_id}`
              const img = prod?.image_url
              return (
                <div key={ci.id ?? idx} className="flex items-center gap-4 p-3 rounded-2xl bg-gray-50/80 border border-gray-100">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border border-gray-100 flex-shrink-0 flex items-center justify-center">
                    {img ? (
                      <Image src={img} alt={nombre} width={48} height={48} className="w-full h-full object-cover" />
                    ) : (
                      <Sparkles className="w-6 h-6 text-amber-200" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{nombre}</p>
                    <p className="text-xs text-gray-500">Cantidad: {ci.quantity}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="p-6 pt-0">
          <button
            onClick={() => { if (disponible) { onAgregar(); onClose() } }}
            disabled={!disponible}
            className="w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-amber-300/30 transition-all"
          >
            {disponible ? 'Agregar al carrito' : 'Agotado'}
          </button>
        </div>
      </div>
    </div>
  )
}
