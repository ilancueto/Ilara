// ============================================
// SERVICIO DE INGRESOS (no ventas)
// ============================================

import { supabase } from '@/lib/supabase';
import type { Income, IncomeFormData, IncomeFilters } from '@/lib/types';

export async function getIncomes(filters?: IncomeFilters): Promise<Income[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase
        .from('incomes')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

    if (filters?.dateFrom) query = query.gte('date', filters.dateFrom);
    if (filters?.dateTo) query = query.lte('date', filters.dateTo);
    if (filters?.type) query = query.eq('type', filters.type);

    const { data, error } = await query;
    if (error) {
        const msg = (error as { message?: string }).message || JSON.stringify(error);
        const code = (error as { code?: string }).code || '';
        console.error('Error fetching incomes:', { message: msg, code, error });
        // Tabla no existe: ejecutar supabase_incomes.sql en el SQL Editor
        if (code === '42P01' || /relation.*incomes.*does not exist/i.test(msg)) {
            throw new Error('La tabla "incomes" no existe. Ejecuta supabase_incomes.sql en el SQL Editor de Supabase.');
        }
        throw error;
    }
    return (data as Income[]) || [];
}

export async function createIncome(form: IncomeFormData): Promise<Income> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const { data, error } = await supabase
        .from('incomes')
        .insert({
            date: form.date,
            amount: form.amount,
            type: form.type,
            description: form.description || '',
            notes: form.notes || null,
            user_id: user.id,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating income:', error);
        throw error;
    }
    return data as Income;
}

export async function updateIncome(id: string, form: Partial<IncomeFormData>): Promise<Income> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    const updatePayload: Record<string, unknown> = {};
    if (form.date != null) updatePayload.date = form.date;
    if (form.amount != null) updatePayload.amount = form.amount;
    if (form.type != null) updatePayload.type = form.type;
    if (form.description != null) updatePayload.description = form.description;
    if (form.notes !== undefined) updatePayload.notes = form.notes;
    updatePayload.updated_by = user.id;

    const { data, error } = await supabase
        .from('incomes')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating income:', error);
        throw error;
    }
    return data as Income;
}

export async function deleteIncome(id: string): Promise<void> {
    const { error } = await supabase.from('incomes').delete().eq('id', id);
    if (error) {
        console.error('Error deleting income:', error);
        throw error;
    }
}
