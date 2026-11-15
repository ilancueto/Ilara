'use client';

// ============================================
// PANEL LATERAL DE FILTROS — GASTOS (PASTEL)
// ============================================

import { ExpenseFilters, ExpenseCategory, PaymentMethod, EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/types';
import { Filter, X, ChevronDown } from 'lucide-react';
import { PastelCard } from '@/components/ui/PastelCard';

interface ExpenseFiltersProps {
    filters: ExpenseFilters;
    onFiltersChange: (filters: ExpenseFilters) => void;
    onClose: () => void;
}

const inputBase =
    'w-full min-w-0 rounded-xl border border-line bg-surface text-ink text-sm leading-normal outline-none transition-colors focus:border-pink-500 dark:focus:border-pink-400 focus:ring-2 focus:ring-pink-500/20 dark:focus:ring-pink-400/20';

const selectBase =
    'w-full min-w-0 rounded-xl border border-line bg-surface text-ink text-sm leading-normal outline-none transition-colors focus:border-pink-500 dark:focus:border-pink-400 focus:ring-2 focus:ring-pink-500/20 appearance-none cursor-pointer pr-10 truncate';

export default function ExpenseFiltersComponent({ filters, onFiltersChange, onClose }: ExpenseFiltersProps) {
    const handleClearFilters = () => {
        onFiltersChange({});
    };

    const hasActiveFilters = Object.keys(filters).length > 0;

    return (
        <PastelCard
            className="flex flex-col overflow-hidden rounded-2xl border border-line shadow-xl dark:shadow-none w-full max-w-[420px] max-h-[70vh]"
            noHover
        >
            {/* Header */}
            <div className="flex items-center justify-between flex-shrink-0 px-6 py-5 border-b border-line">
                <h3 className="font-bold text-ink flex items-center gap-2.5 text-base">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-soft text-accent">
                        <Filter className="w-4 h-4" />
                    </span>
                    Filtrar gastos
                </h3>
                <button
                    type="button"
                    onClick={onClose}
                    className="p-2 rounded-lg text-hint hover:text-gray-600 dark:hover:text-gray-200 hover:bg-surface-soft transition-colors"
                    aria-label="Cerrar panel de filtros"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Body: scroll interno */}
            <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5 flex flex-col gap-6">
                <div className="flex flex-col gap-3">
                    <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                        Rango de fechas
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-muted">Desde</label>
                            <input
                                type="date"
                                value={filters.dateFrom || ''}
                                onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
                                className={`${inputBase} h-12 px-4 py-3`}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-muted">Hasta</label>
                            <input
                                type="date"
                                value={filters.dateTo || ''}
                                onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
                                className={`${inputBase} h-12 px-4 py-3`}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                        Categoría
                    </label>
                    <div className="relative min-w-0">
                        <select
                            value={filters.category || ''}
                            onChange={(e) =>
                                onFiltersChange({ ...filters, category: (e.target.value as ExpenseCategory) || undefined })
                            }
                            className={`${selectBase} h-12 pl-4 pr-10 py-3`}
                            style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}
                        >
                            <option value="">Todas las categorías</option>
                            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        <span
                            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-hint"
                            aria-hidden
                        >
                            <ChevronDown className="w-5 h-5" />
                        </span>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                        Método de pago
                    </label>
                    <div className="relative min-w-0">
                        <select
                            value={filters.paymentMethod || ''}
                            onChange={(e) =>
                                onFiltersChange({ ...filters, paymentMethod: (e.target.value as PaymentMethod) || undefined })
                            }
                            className={`${selectBase} h-12 pl-4 pr-10 py-3`}
                            style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}
                        >
                            <option value="">Todos los métodos</option>
                            {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        <span
                            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-hint"
                            aria-hidden
                        >
                            <ChevronDown className="w-5 h-5" />
                        </span>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                        Monto
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-muted">Mínimo</label>
                            <div className="relative">
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-hint text-sm">
                                    $
                                </span>
                                <input
                                    type="number"
                                    value={filters.minAmount ?? ''}
                                    onChange={(e) =>
                                        onFiltersChange({
                                            ...filters,
                                            minAmount: e.target.value ? Number(e.target.value) : undefined,
                                        })
                                    }
                                    placeholder="0"
                                    className={`${inputBase} h-12 pl-4 pr-8 py-3`}
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-muted">Máximo</label>
                            <div className="relative">
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-hint text-sm">
                                    $
                                </span>
                                <input
                                    type="number"
                                    value={filters.maxAmount ?? ''}
                                    onChange={(e) =>
                                        onFiltersChange({
                                            ...filters,
                                            maxAmount: e.target.value ? Number(e.target.value) : undefined,
                                        })
                                    }
                                    placeholder="—"
                                    className={`${inputBase} h-12 pl-4 pr-8 py-3`}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer fijo */}
            <div className="flex-shrink-0 px-6 py-5 pt-4 border-t border-line bg-gray-50/50 dark:bg-gray-800/40 flex gap-3">
                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={handleClearFilters}
                        className="flex-1 py-3 rounded-xl text-sm font-medium text-muted hover:text-ink hover:bg-surface-soft transition-colors"
                    >
                        Limpiar
                    </button>
                )}
                <button
                    type="button"
                    onClick={onClose}
                    className={`py-3 rounded-xl text-sm font-semibold transition-colors ${hasActiveFilters ? 'btn-primary flex-[2]' : 'btn-primary w-full'}`}
                >
                    Aplicar filtros
                </button>
            </div>
        </PastelCard>
    );
}
