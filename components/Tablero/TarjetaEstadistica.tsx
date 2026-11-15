import { ArrowUpRight } from 'lucide-react'
import { PastelCard } from '@/components/ui/PastelCard'

interface PropsTarjetaEstadistica {
    icono: React.ReactNode
    etiqueta: string
    valor: string
    color: string
    bgIcon: string
    subtitulo?: string
    alerta?: boolean
    trend?: boolean
    selectorPeriodo?: React.ReactNode
    onActivate?: () => void
}

export default function TarjetaEstadistica({ icono, etiqueta, valor, color, bgIcon, subtitulo, alerta, trend, selectorPeriodo, onActivate }: PropsTarjetaEstadistica) {
    return (
        <PastelCard
            noHover
            role={onActivate ? 'button' : undefined}
            tabIndex={onActivate ? 0 : undefined}
            aria-label={onActivate ? `Abrir ${etiqueta}` : undefined}
            onClick={onActivate}
            onKeyDown={
                onActivate
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onActivate()
                        }
                    }
                    : undefined
            }
            className={`
                relative overflow-hidden h-full flex flex-col gap-3 p-4 sm:p-5 min-h-[128px] group
                ${onActivate ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all' : 'cursor-default'}
                ${alerta ? 'ring-2 ring-amber-400/80 dark:ring-amber-500/60' : ''}
            `}
        >
            {/* glow suave del mock */}
            <div
                className="pointer-events-none absolute -right-5 -top-5 w-24 h-24 rounded-full bg-pink-400/10 dark:bg-pink-500/10 blur-2xl"
                aria-hidden
            />
            <div className="relative flex items-start justify-between gap-2 shrink-0">
                <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bgIcon} dark:bg-zinc-800 ${color}`}
                >
                    {icono}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    {alerta && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                            Acción
                        </span>
                    )}
                    {selectorPeriodo}
                    {trend && !selectorPeriodo && (
                        <div className="w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-500 dark:text-emerald-400">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                        </div>
                    )}
                </div>
            </div>
            <div className="relative flex flex-col gap-0.5 min-w-0 mt-auto">
                <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400 font-bold">
                    {etiqueta}
                </p>
                <p className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-gray-50 tracking-tight tabular-nums leading-tight break-all">
                    {valor}
                </p>
                {subtitulo && (
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {subtitulo}
                    </p>
                )}
            </div>
        </PastelCard>
    )
}
