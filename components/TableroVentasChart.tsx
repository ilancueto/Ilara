'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export type VentaDiaChartPoint = { fecha: string; total: number; cantidad: number }

type Props = {
    ventasPorDia: VentaDiaChartPoint[]
    theme: 'light' | 'dark'
}

/** Gráfico extraído para cargar Recharts en chunk aparte (mejor TTI/LCP en `/`). */
export default function TableroVentasChart({ ventasPorDia, theme }: Props) {
    return (
        <div className="flex-1 min-h-[280px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ventasPorDia} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="barGradientPink" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f472b6" />
                            <stop offset="100%" stopColor="#db2777" />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(236,72,153,0.08)'} />
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
                            return [`$${n.toLocaleString()}`, 'Ventas']
                        }}
                    />
                    <Bar dataKey="total" radius={[8, 8, 8, 8]} fill="url(#barGradientPink)" barSize={32} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}
