import { Expense } from '@/lib/types';
import {
    getCategoryIcon,
    getCategoryLabel,
    getPaymentMethodLabel,
    formatCurrency,
    formatDate
} from '@/lib/expenseUtils';
import { Pencil, Trash2, Receipt } from 'lucide-react';
import { PastelCard } from '@/components/ui/PastelCard';

interface ExpenseCardProps {
    expense: Expense;
    onEdit: (expense: Expense) => void;
    onDelete: (id: string) => void;
}

export default function ExpenseCard({ expense, onEdit, onDelete }: ExpenseCardProps) {
    return (
        <PastelCard className="p-5 sm:p-7 group hover:-translate-y-1 transition-transform duration-300 border-pink-100/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6 relative z-10">
                {/* Left: Icon & Info */}
                <div className="flex items-center gap-4 sm:gap-6 flex-1 min-w-0">
                    {/* Icon Box */}
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-pink-50 border border-pink-100 flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 group-hover:scale-105 transition-transform duration-300 text-pink-500 shadow-sm">
                        {getCategoryIcon(expense.category)}
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col gap-2 sm:gap-2.5 overflow-hidden">
                        <div className="flex items-center gap-2 min-w-0">
                            <h3 className="font-bold text-gray-900 text-base sm:text-lg truncate leading-snug group-hover:text-pink-600 transition-colors min-w-0">
                                {expense.description}
                            </h3>
                            {expense.receipt_url && (
                                <a
                                    href={expense.receipt_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 rounded-lg bg-pink-50 text-pink-500 hover:bg-pink-100 hover:text-pink-600 flex-shrink-0 transition-colors"
                                    title="Ver comprobante"
                                >
                                    <Receipt size={14} />
                                </a>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                            <span className="text-pink-500">{getCategoryLabel(expense.category)}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                            <span>{formatDate(expense.date)}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                            <span className="text-gray-400">{getPaymentMethodLabel(expense.payment_method)}</span>
                        </div>
                    </div>
                </div>

                {/* Right: Amount & Actions - en mobile va debajo sin apretar */}
                <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-5 flex-shrink-0 border-t border-pink-100/50 pt-4 sm:border-0 sm:pt-0">
                    <div className="text-left sm:text-right">
                        <span className="block text-xl font-extrabold text-gray-900 tabular-nums leading-none group-hover:text-pink-600 transition-colors">
                            {formatCurrency(expense.amount)}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 sm:opacity-0 sm:group-hover:opacity-100 transform translate-x-0 sm:translate-x-4 sm:group-hover:translate-x-0 transition-all duration-300">
                        <button
                            onClick={() => onEdit(expense)}
                            className="p-2 text-gray-400 hover:text-pink-600 hover:bg-pink-50 rounded-xl transition-colors"
                            title="Editar"
                        >
                            <Pencil size={18} />
                        </button>
                        <button
                            onClick={() => onDelete(expense.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                            title="Eliminar"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Notes footer if exists */}
            {expense.notes && (
                <div className="mt-4 pl-0 sm:pl-[4.75rem] relative z-10">
                    <p className="text-sm text-gray-500 italic truncate border-l-2 border-pink-100 pl-4">
                        {expense.notes}
                    </p>
                </div>
            )}
        </PastelCard>
    );
}
