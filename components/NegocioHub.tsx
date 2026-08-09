'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  TrendingUp,
  Wallet,
  Store,
  Download,
  ArrowRight,
} from 'lucide-react'
import ExportarDatos from '@/components/ExportarDatos'

import type { AppTab } from '@/lib/appTabs'

type Props = {
  onNavigate: (tab: AppTab) => void
}

const tiles = [
  {
    id: 'incomes' as const,
    title: 'Ingresos',
    description: 'Historial de ventas, cuentas por cobrar y otros ingresos.',
    go: 'Abrir',
    icon: TrendingUp,
    tone: 'emerald' as const,
    kind: 'tab' as const,
  },
  {
    id: 'expenses' as const,
    title: 'Gastos',
    description: 'Egresos por categoría, comprobantes y balance del mes.',
    go: 'Abrir',
    icon: Wallet,
    tone: 'amber' as const,
    kind: 'tab' as const,
  },
  {
    id: 'catalogo' as const,
    title: 'Catálogo público',
    description: 'Lo que ven tus clientas: productos, combos y WhatsApp.',
    go: 'Ver vitrina',
    icon: Store,
    tone: 'violet' as const,
    kind: 'link' as const,
    href: '/catalogo',
  },
  {
    id: 'export' as const,
    title: 'Exportar datos',
    description: 'CSV / JSON de productos, ventas, clientes y gastos.',
    go: 'Exportar',
    icon: Download,
    tone: 'pink' as const,
    kind: 'action' as const,
  },
]

const toneClass: Record<(typeof tiles)[number]['tone'], string> = {
  emerald:
    'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
  amber:
    'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  violet:
    'bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300',
  pink: 'bg-pink-50 text-pink-600 dark:bg-pink-900/40 dark:text-pink-400',
}

export default function NegocioHub({ onNavigate }: Props) {
  const [mostrarExportar, setMostrarExportar] = useState(false)

  return (
    <div className="flex flex-col gap-6 sm:gap-8 animate-fade-in pb-4 text-gray-800 dark:text-gray-100">
      <div className="min-w-0">
        <h2 className="text-2xl sm:text-[1.65rem] font-extrabold tracking-tight text-gray-900 dark:text-gray-50">
          Negocio
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
          Finanzas, vitrina y respaldo
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {tiles.map((tile) => {
          const Icon = tile.icon
          const iconBox = (
            <span
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${toneClass[tile.tone]}`}
            >
              <Icon className="w-5 h-5" strokeWidth={2.25} aria-hidden />
            </span>
          )

          const body = (
            <>
              {iconBox}
              <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                <h3 className="text-base font-extrabold tracking-tight text-gray-900 dark:text-gray-50">
                  {tile.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-snug flex-1">
                  {tile.description}
                </p>
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-pink-600 dark:text-pink-400 mt-1">
                  {tile.go}
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden />
                </span>
              </div>
            </>
          )

          const cardClass =
            'group flex flex-col items-start gap-4 text-left p-5 sm:p-6 min-h-[148px] rounded-[20px] border border-pink-100/70 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-[0_4px_24px_rgba(190,24,93,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.35)] hover:shadow-[0_16px_40px_-12px_rgba(190,24,93,0.16)] dark:hover:shadow-[0_16px_40px_-12px_rgba(0,0,0,0.5)] hover:-translate-y-0.5 hover:border-pink-200 dark:hover:border-pink-800/40 transition-all duration-200'

          if (tile.kind === 'tab') {
            return (
              <button
                key={tile.id}
                type="button"
                onClick={() => onNavigate(tile.id)}
                className={cardClass}
              >
                {body}
              </button>
            )
          }

          if (tile.kind === 'link') {
            return (
              <Link key={tile.id} href={tile.href!} className={cardClass}>
                {body}
              </Link>
            )
          }

          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => setMostrarExportar(true)}
              className={cardClass}
            >
              {body}
            </button>
          )
        })}
      </div>

      {mostrarExportar && (
        <ExportarDatos
          mostrar={true}
          cerrar={() => setMostrarExportar(false)}
        />
      )}
    </div>
  )
}
