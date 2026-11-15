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
                            <stop offset="0%" stopColor="#E57A9C" />
                            <stop offset="100%" stopColor="#B8446F" />
                        </linearGradient>
                    </defs>
                    <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke={theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(236,72,153,0.08)'}
                    />
                    <XAxis
                        dataKey="fecha"
                        tick={{ fill: theme === 'dark' ? '#B8A3AE' : '#7A6470', fontSize: 12, fontWeight: 500 }}
                        axisLine={{ stroke: theme === 'dark' ? '#3A2C33' : '#F3DFE0' }}
                        tickLine={false}
                        dy={10}
                    />
                    <YAxis
                        tick={{ fill: theme === 'dark' ? '#B8A3AE' : '#7A6470', fontSize: 12, fontWeight: 500 }}
                        tickFormatter={(value) => (value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value}`)}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip
                        contentStyle={{
                            background: theme === 'dark' ? '#2A1F25' : '#fff',
                            border: theme === 'dark' ? '1px solid #4A3740' : '1px solid #EED3D8',
                            borderRadius: '16px',
                            boxShadow:
                                theme === 'dark'
                                    ? '0 10px 30px -5px rgba(0,0,0,0.4)'
                                    : '0 10px 30px -5px rgba(236,72,153,0.15)',
                            padding: '12px 16px',
                            color: theme === 'dark' ? '#F6E9EF' : '#4A3542',
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
