'use client';

// ============================================
// COMPONENTE: EXPENSE STATS (PASTEL)
// ============================================

import { ExpenseStats } from '@/lib/types';
import { formatCurrency, getCategoryIcon, getCategoryLabel } from '@/lib/expenseUtils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { PastelCard } from '@/components/ui/PastelCard';
import Loader from '@/components/Loader';

interface ExpenseStatsProps {
    stats: ExpenseStats | null;
    isLoading?: boolean;
}

export default function ExpenseStatsComponent({ stats, isLoading }: ExpenseStatsProps) {
    if (isLoading || !stats) {
        return (
            <div className="flex justify-center py-16 mb-10">
                <Loader text="Cargando estadísticas..." />
            </div>
        );
    }

    const getTrendIcon = () => {
        if (stats.percentageChange > 0) return <TrendingUp className="w-4 h-4" />;
        if (stats.percentageChange < 0) return <TrendingDown className="w-4 h-4" />;
        return <Minus className="w-4 h-4" />;
    };

    const daysElapsed = new Date().getDate() || 1;
    const dailyAvg = stats.totalMonth / daysElapsed;
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const proyeccionMensual = dailyAvg * daysInMonth;

    return (
        <div className="flex flex-col gap-6 animate-fade-in-scale">
            {/* KPI row: financial summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                <PastelCard className="p-5 sm:p-6 min-h-[120px] flex flex-col justify-between">
                    <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Gastos del Mes</span>
                    <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100 leading-none mt-2">
                        {formatCurrency(stats.totalMonth)}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">vs mes anterior</span>
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${stats.percentageChange > 0 ? 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400' : stats.percentageChange < 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 dark:text-emerald-400' : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300'}`}>
                            {getTrendIcon()}
                            <span>{Math.abs(stats.percentageChange).toFixed(0)}%</span>
                        </div>
                    </div>
                </PastelCard>
                <PastelCard className="p-5 sm:p-6 min-h-[120px] flex flex-col justify-between">
                    <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mes Anterior</span>
                    <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100 leading-none mt-2">
                        {formatCurrency(stats.totalPrevMonth)}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3">Comparativa directa</p>
                </PastelCard>
                <PastelCard className="p-5 sm:p-6 min-h-[120px] flex flex-col justify-between">
                    <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Promedio Diario</span>
                    <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100 leading-none mt-2">
                        {formatCurrency(dailyAvg)}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3">sobre {daysElapsed} días</p>
                </PastelCard>
                <PastelCard className="p-5 sm:p-6 min-h-[120px] flex flex-col justify-between">
                    <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Proyección Mensual</span>
                    <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100 leading-none mt-2">
                        {formatCurrency(proyeccionMensual)}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3">promedio × {daysInMonth} días</p>
                </PastelCard>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                <PastelCard className="flex flex-col p-5 sm:p-6 min-h-[320px]">
                    <div className="flex items-center gap-2.5 mb-5">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500/20 to-rose-500/20 dark:from-pink-500/30 dark:to-rose-500/30 text-pink-500 dark:text-pink-400">
                            <span className="text-base leading-none">📊</span>
                        </span>
                        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Top Categorías</h3>
                    </div>
                    {stats.topCategories.length > 0 ? (
                        <div className="flex flex-col gap-3">
                            {stats.topCategories.slice(0, 5).map((item, index) => {
                                const percentage = stats.totalMonth > 0 ? (item.total / stats.totalMonth) * 100 : 0;
                                return (
                                    <div
                                        key={item.category}
                                        className="rounded-xl bg-gray-50/80 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/80 p-3 sm:p-4 transition-colors hover:border-pink-200/60 dark:hover:border-pink-800/50"
                                    >
                                        <div className="flex justify-between items-center gap-3 mb-2">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tabular-nums w-4">{index + 1}.</span>
                                                <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-700/80 flex items-center justify-center text-pink-500 dark:text-pink-400 flex-shrink-0">
                                                    {getCategoryIcon(item.category)}
                                                </div>
                                                <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm truncate">{getCategoryLabel(item.category)}</p>
                                            </div>
                                            <span className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums flex-shrink-0">{formatCurrency(item.total)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="h-1.5 flex-1 min-w-0 bg-gray-200/80 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-pink-400 to-rose-400 dark:from-pink-500 dark:to-rose-500"
                                                    style={{ width: `${Math.max(percentage, 4)}%` }}
                                                />
                                            </div>
                                            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 tabular-nums w-8 text-right">{percentage.toFixed(0)}%</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-10 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 flex-1">
                            <span className="text-3xl mb-2 opacity-60">📊</span>
                            <p className="text-sm font-medium">Sin datos suficientes</p>
                        </div>
                    )}
                </PastelCard>

                <PastelCard className="min-h-[320px] flex flex-col p-5 sm:p-6">
                    <div className="flex items-center gap-2.5 mb-6">
                        <div className="w-1 h-6 bg-blue-400 dark:bg-blue-500 rounded-full flex-shrink-0" />
                        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Tendencia Semestral</h3>
                    </div>
                    <div className="flex-1 flex items-end justify-between gap-2 sm:gap-4 px-2 sm:px-3 pb-4">
                        {stats.trend.map((item, index) => {
                            const maxValue = Math.max(...stats.trend.map(t => t.total)) || 1;
                            const percentage = (item.total / maxValue) * 100;
                            const isCurrent = index === stats.trend.length - 1;

                            return (
                                <div key={index} className="flex-1 flex flex-col items-center justify-end h-full gap-3 group relative w-full">
                                    {/* Tooltip on hover */}
                                    <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 border border-gray-700 px-3 py-2 rounded-lg text-xs font-bold text-white whitespace-nowrap shadow-xl z-20 pointer-events-none transform translate-y-2 group-hover:translate-y-0">
                                        {formatCurrency(item.total)}
                                        <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 border-r border-b border-gray-700 rotate-45"></div>
                                    </div>

                                    <div className="w-full flex-1 flex items-end justify-center relative">
                                        <div
                                            className={`
                                                w-full max-w-[40px] rounded-t-sm transition-all duration-700 ease-out relative
                                                ${isCurrent
                                                    ? 'bg-gradient-to-t from-blue-400 to-cyan-300 dark:from-blue-500 dark:to-cyan-400 shadow-sm'
                                                    : 'bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500'
                                                }
                                            `}
                                            style={{ height: `${Math.max(percentage, 4)}%` }}
                                        >
                                            {isCurrent && <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/50"></div>}
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isCurrent ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                        {item.month.slice(0, 3)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </PastelCard>
            </div>
        </div>
    );
}
