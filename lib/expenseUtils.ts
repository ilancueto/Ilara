// ============================================
// UTILIDADES PARA GASTOS
// ============================================

import { ExpenseCategory, PaymentMethod, Expense, EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from './types';

// Iconos por categoría
export const getCategoryIcon = (category: ExpenseCategory): string => {
    const icons: Record<ExpenseCategory, string> = {
        inventario: '💰',
        alquiler: '🏢',
        servicios: '⚡',
        marketing: '📱',
        envios: '🚚',
        mantenimiento: '🛠️',
        administrativos: '📄',
        personal: '👥',
        capacitacion: '🎓',
        otros: '🔧',
    };
    return icons[category];
};

// Colores por categoría (Tailwind classes)
export const getCategoryColor = (category: ExpenseCategory): string => {
    const colors: Record<ExpenseCategory, string> = {
        inventario: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        alquiler: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        servicios: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        marketing: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
        envios: 'bg-green-500/20 text-green-400 border-green-500/30',
        mantenimiento: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        administrativos: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
        personal: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
        capacitacion: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
        otros: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    };
    return colors[category];
};

// Obtener label de categoría
export const getCategoryLabel = (category: ExpenseCategory): string => {
    return EXPENSE_CATEGORY_LABELS[category];
};

// Obtener label de método de pago
export const getPaymentMethodLabel = (method: PaymentMethod): string => {
    return PAYMENT_METHOD_LABELS[method];
};

// Formatear moneda
export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

// Formatear fecha
export const formatDate = (date: string): string => {
    return new Date(date).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
};

// Exportar a CSV
export const exportToCSV = (expenses: Expense[], filename: string = 'gastos.csv'): void => {
    // Headers
    const headers = ['Fecha', 'Categoría', 'Descripción', 'Monto', 'Método de Pago', 'Notas'];

    // Rows
    const rows = expenses.map(expense => [
        formatDate(expense.date),
        getCategoryLabel(expense.category),
        expense.description,
        expense.amount.toString(),
        getPaymentMethodLabel(expense.payment_method),
        expense.notes || '',
    ]);

    // Combinar headers y rows
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    // Crear blob y descargar
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Calcular porcentaje de cambio
export const calculatePercentageChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
};

// Obtener nombre del mes
export const getMonthName = (date: Date): string => {
    return date.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
};
