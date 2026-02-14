'use client';

// ============================================
// COMPONENTE: EXPENSE STATS (PASTEL)
// ============================================

import { ExpenseStats } from '@/lib/types';
import { formatCurrency, getCategoryIcon, getCategoryLabel } from '@/lib/expenseUtils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { PastelCard } from '@/components/ui/PastelCard';

interface ExpenseStatsProps {
    stats: ExpenseStats | null;
    isLoading?: boolean;
}

export default function ExpenseStatsComponent({ stats, isLoading }: ExpenseStatsProps) {
    if (isLoading || !stats) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                {[1, 2, 3].map((i) => (
                    <PastelCard key={i} className="animate-pulse h-32 flex flex-col justify-center border-pink-100">
                        <div className="h-4 bg-gray-100 rounded w-1/3 mb-4"></div>
                        <div className="h-8 bg-gray-50 rounded w-1/2"></div>
                    </PastelCard>
                ))}
            </div>
        );
    }

    const getTrendIcon = () => {
        if (stats.percentageChange > 0) return <TrendingUp className="w-4 h-4" />;
        if (stats.percentageChange < 0) return <TrendingDown className="w-4 h-4" />;
        return <Minus className="w-4 h-4" />;
    };

    return (
        <div className="flex flex-col gap-8 animate-fade-in-scale">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Total Mes */}
                <PastelCard className="p-9 min-h-[140px]">
                    <div className="flex justify-between items-start gap-3 mb-6">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gastos del Mes</span>
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border flex-shrink-0 ${stats.percentageChange > 0 ? 'bg-red-50 text-red-500 border-red-100' :
                            stats.percentageChange < 0 ? 'bg-emerald-50 text-emerald-500 border-emerald-100' :
                                'bg-gray-50 text-gray-500 border-gray-100'
                            }`}>
                            {getTrendIcon()}
                            <span>{Math.abs(stats.percentageChange).toFixed(0)}%</span>
                        </div>
                    </div>
                    <p className="text-3xl font-extrabold text-gray-900 group-hover:text-pink-600 transition-colors leading-none mb-6">
                        {formatCurrency(stats.totalMonth)}
                    </p>
                    {/* Progress bar decorativa */}
                    <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-pink-400 to-rose-400 w-[70%] rounded-full opacity-80 shadow-sm" />
                    </div>
                </PastelCard>

                {/* Mes Anterior */}
                <PastelCard className="p-9 min-h-[140px]">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Mes Anterior</p>
                    <p className="text-3xl font-extrabold text-gray-900 leading-none mb-3">
                        {formatCurrency(stats.totalPrevMonth)}
                    </p>
                    <p className="text-xs text-gray-500 leading-relaxed">Comparativa directa con periodo anterior</p>
                </PastelCard>

                {/* Promedio Diario */}
                <PastelCard className="p-9 min-h-[140px]">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Promedio Diario</p>
                    <p className="text-3xl font-extrabold text-gray-900 leading-none mb-3">
                        {formatCurrency(stats.totalMonth / (new Date().getDate() || 1))}
                    </p>
                    <p className="text-xs text-gray-500 leading-relaxed">proyectado en base a {new Date().getDate()} días</p>
                </PastelCard>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Top Categories */}
                <PastelCard className="min-h-[400px] flex flex-col p-8">
                    <div className="flex items-center gap-4 mb-10">
                        <div className="w-1 h-7 bg-pink-500 rounded-full shadow-sm flex-shrink-0"></div>
                        <h3 className="text-lg font-bold text-gray-900">Top Categorías</h3>
                    </div>

                    <div className="flex-1 flex flex-col gap-6 mt-1">
                        {stats.topCategories.length > 0 ? (
                            stats.topCategories.slice(0, 5).map((item) => {
                                const percentage = stats.totalMonth > 0 ? (item.total / stats.totalMonth) * 100 : 0;
                                return (
                                    <div key={item.category} className="group">
                                        <div className="flex justify-between items-center gap-4 mb-3">
                                            <div className="flex items-center gap-4 min-w-0">
                                                <div className="text-xl p-2.5 rounded-xl bg-pink-50 text-pink-500 border border-pink-100 group-hover:border-pink-200 transition-colors flex-shrink-0">
                                                    {getCategoryIcon(item.category)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-gray-800 leading-snug">{getCategoryLabel(item.category)}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">{percentage.toFixed(0)}% del total</p>
                                                </div>
                                            </div>
                                            <span className="text-sm font-bold text-gray-900 tabular-nums group-hover:text-pink-600 transition-colors flex-shrink-0">
                                                {formatCurrency(item.total)}
                                            </span>
                                        </div>
                                        {/* Barra de progreso custom */}
                                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-pink-400 to-rose-400 rounded-full relative transition-all duration-500"
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                                <span className="text-4xl mb-2">📊</span>
                                <p>Sin datos suficientes</p>
                            </div>
                        )}
                    </div>
                </PastelCard>

                {/* Monthly Trend Chart */}
                <PastelCard className="min-h-[400px] flex flex-col p-8">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-1 h-7 bg-blue-400 rounded-full shadow-sm flex-shrink-0"></div>
                        <h3 className="text-lg font-bold text-gray-900">Tendencia Semestral</h3>
                    </div>

                    <div className="flex-1 flex items-end justify-between gap-4 px-3 pb-5">
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
                                                    ? 'bg-gradient-to-t from-blue-400 to-cyan-300 shadow-sm'
                                                    : 'bg-gray-100 hover:bg-gray-200'
                                                }
                                            `}
                                            style={{ height: `${Math.max(percentage, 4)}%` }}
                                        >
                                            {isCurrent && <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/50"></div>}
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isCurrent ? 'text-blue-500' : 'text-gray-400'}`}>
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
