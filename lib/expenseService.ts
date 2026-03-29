// ============================================
// SERVICIO DE GASTOS - SUPABASE
// ============================================

import { supabase } from '@/lib/supabase';
import { deleteReceiptObject, getReceiptSignedUrl, uploadReceiptFile } from '@/lib/receiptStorage';
import {
    Expense,
    ExpenseFormData,
    ExpenseFilters,
    ExpenseStats,
    ExpenseCategory
} from './types';
import { calculatePercentageChange, getMonthName } from './expenseUtils';

// Obtener gastos con filtros
export async function getExpenses(filters?: ExpenseFilters): Promise<Expense[]> {

    let query = supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

    // Aplicar filtros
    if (filters?.dateFrom) {
        query = query.gte('date', filters.dateFrom);
    }

    if (filters?.dateTo) {
        query = query.lte('date', filters.dateTo);
    }

    if (filters?.category) {
        query = query.eq('category', filters.category);
    }

    if (filters?.paymentMethod) {
        query = query.eq('payment_method', filters.paymentMethod);
    }

    if (filters?.minAmount !== undefined) {
        query = query.gte('amount', filters.minAmount);
    }

    if (filters?.maxAmount !== undefined) {
        query = query.lte('amount', filters.maxAmount);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching expenses:', error);
        throw error;
    }

    return data || [];
}

// Crear nuevo gasto
export async function createExpense(formData: ExpenseFormData): Promise<Expense> {

    // Subir comprobante si existe
    let receiptUrl: string | undefined;
    if (formData.receipt) {
        receiptUrl = await uploadReceiptFile(formData.receipt, 'expense');
    }

    // Obtener user_id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const expenseData = {
        date: formData.date,
        category: formData.category,
        description: formData.description,
        amount: formData.amount,
        payment_method: formData.payment_method,
        receipt_url: receiptUrl,
        notes: formData.notes,
        user_id: user.id,
    };

    const { data, error } = await supabase
        .from('expenses')
        .insert(expenseData)
        .select()
        .single();

    if (error) {
        console.error('Error creating expense:', error);
        // Si falla, eliminar el comprobante subido
        if (receiptUrl) {
            await deleteReceiptObject(receiptUrl);
        }
        throw error;
    }

    return data;
}

// Actualizar gasto
export async function updateExpense(id: string, formData: Partial<ExpenseFormData>): Promise<Expense> {

    // Si hay un nuevo comprobante, subirlo
    let receiptUrl: string | undefined;
    if (formData.receipt) {
        receiptUrl = await uploadReceiptFile(formData.receipt, 'expense');
    }

    const { data: { user } } = await supabase.auth.getUser();
    const updateData: Record<string, unknown> = {
        ...(formData.date && { date: formData.date }),
        ...(formData.category && { category: formData.category }),
        ...(formData.description && { description: formData.description }),
        ...(formData.amount !== undefined && { amount: formData.amount }),
        ...(formData.payment_method && { payment_method: formData.payment_method }),
        ...(formData.notes !== undefined && { notes: formData.notes }),
        ...(receiptUrl && { receipt_url: receiptUrl }),
    };
    if (user?.id) updateData.updated_by = user.id;

    const { data, error } = await supabase
        .from('expenses')
        .update(updateData as Record<string, never>)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating expense:', error);
        // Si falla, eliminar el nuevo comprobante subido
        if (receiptUrl) {
            await deleteReceiptObject(receiptUrl);
        }
        throw error;
    }

    return data;
}

// Eliminar gasto
export async function deleteExpense(id: string): Promise<void> {

    // Primero obtener el gasto para eliminar el comprobante
    const { data: expense } = await supabase
        .from('expenses')
        .select('receipt_url')
        .eq('id', id)
        .single();

    // Eliminar el gasto
    const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting expense:', error);
        throw error;
    }

    // Eliminar el comprobante si existe
    if (expense?.receipt_url) {
        await deleteReceiptObject(expense.receipt_url);
    }
}

/** URL temporal para ver comprobante de gasto (bucket privado). */
export async function getExpenseReceiptViewUrl(expense: Pick<Expense, 'receipt_url'>): Promise<string | null> {
    return getReceiptSignedUrl(expense.receipt_url);
}

// Obtener estadísticas de gastos
export async function getExpenseStats(): Promise<ExpenseStats> {

    // Obtener fecha actual
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Primer día del mes actual
    const firstDayCurrentMonth = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];

    // Primer día del mes anterior
    const firstDayPrevMonth = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0];
    const lastDayPrevMonth = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

    // Gastos del mes actual
    const { data: currentMonthExpenses } = await supabase
        .from('expenses')
        .select('amount')
        .gte('date', firstDayCurrentMonth);

    const totalMonth = currentMonthExpenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;

    // Gastos del mes anterior
    const { data: prevMonthExpenses } = await supabase
        .from('expenses')
        .select('amount')
        .gte('date', firstDayPrevMonth)
        .lte('date', lastDayPrevMonth);

    const totalPrevMonth = prevMonthExpenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;

    // Calcular porcentaje de cambio
    const percentageChange = calculatePercentageChange(totalMonth, totalPrevMonth);

    // Gastos por categoría (últimos 30 días)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data: recentExpenses } = await supabase
        .from('expenses')
        .select('category, amount')
        .gte('date', thirtyDaysAgo);

    const byCategory = recentExpenses?.reduce((acc, exp) => {
        const existing = acc.find(item => item.category === exp.category);
        if (existing) {
            existing.total += Number(exp.amount);
            existing.count += 1;
        } else {
            acc.push({
                category: exp.category as ExpenseCategory,
                total: Number(exp.amount),
                count: 1,
            });
        }
        return acc;
    }, [] as { category: ExpenseCategory; total: number; count: number }[]) || [];

    // Ordenar por total descendente
    byCategory.sort((a, b) => b.total - a.total);

    // Top 5 categorías
    const topCategories = byCategory.slice(0, 5);

    // Tendencia de los últimos 6 meses
    const trend: { month: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(currentYear, currentMonth - i, 1);
        const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).toISOString().split('T')[0];

        const { data: monthExpenses } = await supabase
            .from('expenses')
            .select('amount')
            .gte('date', firstDay)
            .lte('date', lastDay);

        const total = monthExpenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;

        trend.push({
            month: getMonthName(monthDate),
            total,
        });
    }

    return {
        totalMonth,
        totalPrevMonth,
        percentageChange,
        byCategory,
        trend,
        topCategories,
    };
}
