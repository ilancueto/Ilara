'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  TrendingUp,
  Wallet,
  Store,
  Download,
  ArrowRight,
  ClipboardList,
  AlertTriangle,
  RotateCcw,
  ChartNoAxesCombined,
  Banknote,
  Users,
} from 'lucide-react'
import ExportarDatos from '@/components/ExportarDatos'

import type { AppTab } from '@/lib/appTabs'
import type { RoleCapabilities } from '@/lib/auth/roles'

type Props = {
  onNavigate: (tab: AppTab) => void
  /** Capacidades del rol (UX). La DB sigue siendo la autoridad. */
  caps: RoleCapabilities
}

type Tile = {
  id: string
  title: string
  description: string
  go: string
  icon: typeof TrendingUp
  tone: 'emerald' | 'amber' | 'violet' | 'pink' | 'sky'
  kind: 'tab' | 'link' | 'action'
  href?: string
  tab?: AppTab
  /** Quién ve el tile (UX). */
  visible: (caps: RoleCapabilities) => boolean
}

const tiles: Tile[] = [
  {
    id: 'margin_reports',
    title: 'Margen real',
    description: 'Mostrador, catálogo y total combinado. Sin inventar costos faltantes.',
    go: 'Ver reporte',
    icon: ChartNoAxesCombined,
    tone: 'emerald',
    kind: 'tab',
    tab: 'margin_reports',
    visible: (c) => c.isAdmin,
  },
  {
    id: 'payments',
    title: 'Precios y pagos',
    description: 'Configuración de precios, medios, activación y alertas. No es operación de pedidos.',
    go: 'Configurar',
    icon: Banknote,
    tone: 'violet',
    kind: 'tab',
    tab: 'payments',
    visible: (c) => c.isAdmin,
  },
  {
    id: 'incomes',
    title: 'Cuentas y caja',
    description: 'Resumen financiero de mostrador, pedidos online y combinado. Sin duplicar la caja.',
    go: 'Abrir',
    icon: TrendingUp,
    tone: 'emerald',
    kind: 'tab',
    tab: 'incomes',
    visible: (c) => c.isAdmin,
  },
  {
    id: 'expenses',
    title: 'Gastos',
    description: 'Egresos por categoría, comprobantes y balance del mes.',
    go: 'Abrir',
    icon: Wallet,
    tone: 'amber',
    kind: 'tab',
    tab: 'expenses',
    visible: (c) => c.canManageFinance,
  },
  {
    id: 'orders',
    title: 'Pedidos web',
    description: 'Operación, pago, envío, devolución y contacto de la clienta.',
    go: 'Abrir',
    icon: ClipboardList,
    tone: 'sky',
    kind: 'tab',
    tab: 'orders',
    visible: (c) => c.isAdmin,
  },
  {
    id: 'stock_alerts',
    title: 'Alertas de stock',
    description: 'Reposición: productos bajo el mínimo, estado e historial.',
    go: 'Abrir',
    icon: AlertTriangle,
    tone: 'amber',
    kind: 'tab',
    tab: 'stock_alerts',
    visible: (c) => c.isAdmin,
  },
  {
    id: 'returns',
    title: 'Devoluciones',
    description: 'Ventas en local y pedidos online, con reglas claras según el origen.',
    go: 'Abrir',
    icon: RotateCcw,
    tone: 'pink',
    kind: 'tab',
    tab: 'returns',
    visible: (c) => c.isAdmin,
  },
  {
    id: 'customers',
    title: 'Clientes',
    description: 'Historial unificado de mostrador y catálogo.',
    go: 'Abrir',
    icon: Users,
    tone: 'sky',
    kind: 'tab',
    tab: 'customers',
    visible: (c) => c.canUsePos || c.isAdmin,
  },
  {
    id: 'catalogo',
    title: 'Catálogo público',
    description: 'Lo que ven tus clientas: productos, combos y WhatsApp.',
    go: 'Ver vitrina',
    icon: Store,
    tone: 'violet',
    kind: 'link',
    href: '/catalogo',
    visible: (c) => c.canUsePos || c.isAdmin,
  },
  {
    id: 'export',
    title: 'Exportar datos',
    description: 'CSV / JSON de productos, ventas, clientes y gastos.',
    go: 'Exportar',
    icon: Download,
    tone: 'pink',
    kind: 'action',
    // Export puede incluir costos: solo admin (UX; API/RLS también limitan).
    visible: (c) => c.isAdmin,
  },
]

const toneClass: Record<Tile['tone'], string> = {
  emerald:
    'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
  amber:
    'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  violet:
    'bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300',
  pink: 'bg-pink-50 text-pink-600 dark:bg-pink-900/40 dark:text-pink-400',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300',
}

export default function NegocioHub({ onNavigate, caps }: Props) {
  const [mostrarExportar, setMostrarExportar] = useState(false)
  const visibleTiles = tiles.filter((t) => t.visible(caps))

  return (
    <div className="flex flex-col gap-6 sm:gap-8 animate-fade-in pb-4 text-gray-800 dark:text-gray-100">
      <div className="min-w-0">
        <h2 className="text-2xl sm:text-[1.65rem] font-extrabold tracking-tight text-gray-900 dark:text-gray-50">
          Negocio
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
          Pedidos, caja, margen, clientas y devoluciones en un mismo lugar
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {visibleTiles.map((tile) => {
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

          if (tile.kind === 'tab' && tile.tab) {
            return (
              <button
                key={tile.id}
                type="button"
                onClick={() => onNavigate(tile.tab!)}
                className={cardClass}
              >
                {body}
              </button>
            )
          }

          if (tile.kind === 'link' && tile.href) {
            return (
              <Link key={tile.id} href={tile.href} className={cardClass}>
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

      {mostrarExportar && caps.isAdmin && (
        <ExportarDatos
          mostrar={true}
          cerrar={() => setMostrarExportar(false)}
        />
      )}
    </div>
  )
}
