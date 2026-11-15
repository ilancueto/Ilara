import { ArrowUpRight } from 'lucide-react'
import { PastelCard, type PastelTone } from '@/components/ui/PastelCard'

interface PropsTarjetaEstadistica {
    icono: React.ReactNode
    etiqueta: string
    valor: string
    /** Color pastel del bloque (pastel bento). */
    tone?: PastelTone
    /** Bloque principal: más grande y en el color de la marca. */
    destacada?: boolean
    subtitulo?: string
    alerta?: boolean
    trend?: boolean
    selectorPeriodo?: React.ReactNode
    /** Contenido extra al pie (por ejemplo, un mini gráfico). */
    children?: React.ReactNode
    onActivate?: () => void
}

export default function TarjetaEstadistica({
    icono,
    etiqueta,
    valor,
    tone = 0,
    destacada = false,
    subtitulo,
    alerta,
    trend,
    selectorPeriodo,
    children,
    onActivate,
}: PropsTarjetaEstadistica) {
    return (
        <PastelCard
            noHover
            tone={destacada ? 'primary' : tone}
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
                relative overflow-hidden h-full flex flex-col gap-3 p-4 sm:p-5 min-h-[128px]
                ${destacada ? 'sm:p-6' : ''}
                ${onActivate ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--ui-shadow)] transition-all' : 'cursor-default'}
                ${alerta ? 'ring-2 ring-amber-400/80 dark:ring-amber-500/60' : ''}
            `}
        >
            <div className="relative flex items-start justify-between gap-2 shrink-0">
                <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        destacada ? 'bg-white/20 text-white' : 'bg-surface text-primary-ink'
                    }`}
                >
                    {icono}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    {alerta && (
                        <span className="px-2.5 py-1 rounded-full bg-surface text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                            Acción
                        </span>
                    )}
                    {selectorPeriodo}
                    {trend && !selectorPeriodo && (
                        <div className="w-7 h-7 rounded-full bg-surface flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                        </div>
                    )}
                </div>
            </div>
            <div className="relative flex flex-col gap-0.5 min-w-0 mt-auto">
                <div className={`text-[11px] uppercase tracking-[0.08em] font-bold ${destacada ? 'text-white/85' : 'text-muted'}`}>
                    {etiqueta}
                </div>
                <div
                    className={`font-bold tracking-tight tabular-nums leading-tight break-all ${
                        destacada ? 'text-3xl sm:text-5xl text-white' : 'text-xl sm:text-2xl text-ink'
                    }`}
                >
                    {valor}
                </div>
                {subtitulo && (
                    <div className={`text-xs font-semibold mt-1 line-clamp-2 ${destacada ? 'text-white/85' : 'text-muted'}`}>
                        {subtitulo}
                    </div>
                )}
            </div>
            {children}
        </PastelCard>
    )
}
