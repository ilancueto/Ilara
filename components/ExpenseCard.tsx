import { Expense } from '@/lib/types';
import { useToast } from '@/context/ToastContext';
import { getExpenseReceiptViewUrl } from '@/lib/expenseService';
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
    const { showError } = useToast();

    const abrirComprobante = async () => {
        const u = await getExpenseReceiptViewUrl(expense);
        if (u) window.open(u, '_blank', 'noopener,noreferrer');
        else showError('No se pudo abrir el comprobante.');
    };

    return (
        <PastelCard className="p-4 sm:p-5 group hover:-translate-y-0.5 transition-transform duration-200 border-line">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-5 relative z-10">
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-primary-soft border border-line flex items-center justify-center text-lg sm:text-xl flex-shrink-0 text-accent">
                        {getCategoryIcon(expense.category)}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5 overflow-hidden">
                        <div className="flex items-center gap-2 min-w-0">
                            <h3 className="font-bold text-ink text-sm sm:text-base truncate leading-snug group-hover:text-accent transition-colors min-w-0">
                                {expense.description}
                            </h3>
                            {expense.receipt_url && (
                                <button
                                    type="button"
                                    onClick={() => void abrirComprobante()}
                                    className="p-1.5 rounded-lg bg-primary-soft text-accent hover:bg-pink-100 dark:hover:bg-pink-800/50 flex-shrink-0 transition-colors"
                                    title="Ver comprobante"
                                >
                                    <Receipt size={14} />
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-medium text-muted uppercase tracking-wide">
                            <span className="text-accent">{getCategoryLabel(expense.category)}</span>
                            <span className="w-0.5 h-0.5 rounded-full bg-gray-300 dark:bg-gray-600" aria-hidden />
                            <span>{formatDate(expense.date)}</span>
                            <span className="w-0.5 h-0.5 rounded-full bg-gray-300 dark:bg-gray-600" aria-hidden />
                            <span className="text-hint">{getPaymentMethodLabel(expense.payment_method)}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 border-t border-line pt-3 sm:border-0 sm:pt-0">
                    <span className="text-lg font-extrabold text-ink tabular-nums leading-none group-hover:text-accent transition-colors">
                        {formatCurrency(expense.amount)}
                    </span>
                    <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                        <button
                            onClick={() => onEdit(expense)}
                            className="p-2 text-hint hover:text-accent hover:bg-primary-soft rounded-lg transition-colors"
                            title="Editar"
                        >
                            <Pencil size={16} />
                        </button>
                        <button
                            onClick={() => onDelete(expense.id)}
                            className="p-2 text-hint hover:text-danger hover:bg-danger-soft rounded-lg transition-colors"
                            title="Eliminar"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            </div>
            {expense.notes && (
                <div className="mt-3 pl-0 sm:pl-14 relative z-10">
                    <p className="text-xs text-muted italic truncate border-l-2 border-line pl-3">
                        {expense.notes}
                    </p>
                </div>
            )}
        </PastelCard>
    );
}
