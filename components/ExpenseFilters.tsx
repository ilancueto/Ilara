'use client';

// ============================================
// COMPONENTE: EXPENSE FILTERS (PASTEL)
// ============================================

import { ExpenseFilters, ExpenseCategory, PaymentMethod, EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/types';
import { Filter, X } from 'lucide-react';
import { useState } from 'react';
import { PastelCard } from '@/components/ui/PastelCard';

interface ExpenseFiltersProps {
    filters: ExpenseFilters;
    onFiltersChange: (filters: ExpenseFilters) => void;
}

export default function ExpenseFiltersComponent({ filters, onFiltersChange }: ExpenseFiltersProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleClearFilters = () => {
        onFiltersChange({});
        setIsOpen(false);
    };

    const hasActiveFilters = Object.keys(filters).length > 0;

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium text-sm ${hasActiveFilters
                    ? 'bg-pink-50 text-pink-600 border border-pink-200 shadow-sm'
                    : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50 hover:text-gray-700'
                    }`}
            >
                <Filter className="w-4 h-4" />
                Filtros
                {hasActiveFilters && (
                    <span className="bg-pink-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
                        {Object.keys(filters).length}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsOpen(false)} />
                    <PastelCard className="absolute top-full right-0 mt-3 w-80 p-5 !shadow-2xl z-50 animate-fade-in-scale border-pink-100" noHover>
                        <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-100">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Filter className="w-4 h-4 text-pink-500" />
                                Filtrar Gastos
                            </h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Rango de fechas */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                                        Desde
                                    </label>
                                    <input
                                        type="date"
                                        value={filters.dateFrom || ''}
                                        onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                                        Hasta
                                    </label>
                                    <input
                                        type="date"
                                        value={filters.dateTo || ''}
                                        onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Categoría */}
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                                    Categoría
                                </label>
                                <select
                                    value={filters.category || ''}
                                    onChange={(e) => onFiltersChange({ ...filters, category: e.target.value as ExpenseCategory || undefined })}
                                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="">Todas las categorías</option>
                                    {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
                                        <option key={key} value={key}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Método de pago */}
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                                    Método de pago
                                </label>
                                <select
                                    value={filters.paymentMethod || ''}
                                    onChange={(e) => onFiltersChange({ ...filters, paymentMethod: e.target.value as PaymentMethod || undefined })}
                                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="">Todos los métodos</option>
                                    {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
                                        <option key={key} value={key}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Rango de montos */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                                        Mínimo
                                    </label>
                                    <div className="relative">
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                        <input
                                            type="number"
                                            value={filters.minAmount || ''}
                                            onChange={(e) => onFiltersChange({ ...filters, minAmount: e.target.value ? Number(e.target.value) : undefined })}
                                            placeholder="0"
                                            className="w-full bg-white border border-gray-200 rounded-xl pl-3 pr-8 py-2 text-sm text-gray-800 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                                        Máximo
                                    </label>
                                    <div className="relative">
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                        <input
                                            type="number"
                                            value={filters.maxAmount || ''}
                                            onChange={(e) => onFiltersChange({ ...filters, maxAmount: e.target.value ? Number(e.target.value) : undefined })}
                                            placeholder="Max"
                                            className="w-full bg-white border border-gray-200 rounded-xl pl-3 pr-8 py-2 text-sm text-gray-800 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Botón limpiar */}
                        {hasActiveFilters && (
                            <button
                                onClick={handleClearFilters}
                                className="w-full mt-6 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-700 rounded-xl transition-all text-sm font-medium border border-gray-200"
                            >
                                Limpiar todos los filtros
                            </button>
                        )}
                    </PastelCard>
                </>
            )}
        </div>
    );
}
