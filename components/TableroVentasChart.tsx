'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

export type VentaDiaChartPoint = { fecha: string; total: number; cantidad: number }

type Props = {
    ventasPorDia: VentaDiaChartPoint[]
    theme: 'light' | 'dark'
    /** Leyenda del tooltip (día vs mes). */
    valueLabel?: string
}

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

/** Altura fija del gráfico: no se observa en ResizeObserver (evita bucle flex → grow infinito). */
const CHART_HEIGHT = 300

/** Gráfico extraído para cargar Recharts en chunk aparte (mejor TTI/LCP en `/`). */
export default function TableroVentasChart({ ventasPorDia, theme, valueLabel = 'Ventas' }: Props) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [isHydrated, setIsHydrated] = useState(false)
    const [width, setWidth] = useState(0)

    useIsomorphicLayoutEffect(() => {
        const node = containerRef.current
        if (!node) return

        const updateWidth = () => {
            const nextWidth = Math.max(0, Math.round(node.clientWidth))
            setWidth((prev) => (prev === nextWidth ? prev : nextWidth))
        }

        updateWidth()
        setIsHydrated(true)

        const observer = new ResizeObserver(updateWidth)
        observer.observe(node)
        return () => observer.disconnect()
    }, [])

    const canRenderChart = isHydrated && width > 0

    return (
        <div
            ref={containerRef}
            className="w-full min-w-0 overflow-hidden"
            style={{ height: CHART_HEIGHT }}
        >
            {canRenderChart ? (
                <BarChart
                    width={width}
                    height={CHART_HEIGHT}
                    data={ventasPorDia}
                    // bottom: espacio para ticks del eje X (sin padding extra en el wrapper → sin scroll rosa)
                    margin={{ top: 8, right: 8, left: -20, bottom: 32 }}
                >
                    <defs>
                        <linearGradient id="barGradientPink" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f472b6" />
                            <stop offset="100%" stopColor="#db2777" />
                        </linearGradient>
                    </defs>
                    <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke={theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(236,72,153,0.08)'}
                    />
                    <XAxis
                        dataKey="fecha"
                        tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12, fontWeight: 500 }}
                        axisLine={{ stroke: theme === 'dark' ? '#3f3f46' : '#fce7f3' }}
                        tickLine={false}
                        dy={10}
                    />
                    <YAxis
                        tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12, fontWeight: 500 }}
                        tickFormatter={(value) => (value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value}`)}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip
                        contentStyle={{
                            background: theme === 'dark' ? '#27272a' : '#fff',
                            border: theme === 'dark' ? '1px solid #3f3f46' : '1px solid #fbcfe8',
                            borderRadius: '16px',
                            boxShadow:
                                theme === 'dark'
                                    ? '0 10px 30px -5px rgba(0,0,0,0.4)'
                                    : '0 10px 30px -5px rgba(236,72,153,0.15)',
                            padding: '12px 16px',
                            color: theme === 'dark' ? '#f3f4f6' : '#1f2937',
                        }}
                        cursor={{ fill: 'rgba(236, 72, 153, 0.06)' }}
                        formatter={(value: unknown) => {
                            const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
                            return [`$${n.toLocaleString()}`, valueLabel]
                        }}
                    />
                    <Bar dataKey="total" radius={[8, 8, 8, 8]} fill="url(#barGradientPink)" barSize={32} />
                </BarChart>
            ) : null}
        </div>
    )
}
