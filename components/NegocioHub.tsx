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
import type { PanelNavigate } from '@/lib/appNavigation'

type Props = {
  onNavigate: PanelNavigate
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

/** Bloque pastel de cada acceso (pastel bento); el ícono va sobre blanco. */
const toneClass: Record<Tile['tone'], string> = {
  emerald: 'bg-tint-2',
  amber: 'bg-tint-1',
  violet: 'bg-tint-3',
  pink: 'bg-tint-0',
  sky: 'bg-tint-4',
}

export default function NegocioHub({ onNavigate, caps }: Props) {
  const [mostrarExportar, setMostrarExportar] = useState(false)
  const visibleTiles = tiles.filter((t) => t.visible(caps))

  return (
    <div className="flex flex-col gap-6 sm:gap-8 animate-fade-in pb-4 text-ink">
      <div className="min-w-0">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary-ink">
          Negocio
        </h2>
        <p className="text-sm text-muted mt-1 font-medium">
          Pedidos, caja, margen, clientas y devoluciones en un mismo lugar
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {visibleTiles.map((tile) => {
          const Icon = tile.icon
          const iconBox = (
            <span
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-surface text-primary-ink"
            >
              <Icon className="w-5 h-5" strokeWidth={2.25} aria-hidden />
            </span>
          )

          const body = (
            <>
              {iconBox}
              <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                <h3 className="text-base font-extrabold tracking-tight text-ink">
                  {tile.title}
                </h3>
                <p className="text-sm text-muted leading-snug flex-1">
                  {tile.description}
                </p>
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-accent mt-1">
                  {tile.go}
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden />
                </span>
              </div>
            </>
          )

          const cardClass = `group flex flex-col items-start gap-4 text-left p-5 sm:p-6 min-h-[148px] rounded-card border border-transparent ${toneClass[tile.tone]} hover:-translate-y-0.5 hover:border-primary transition-all duration-200`

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
