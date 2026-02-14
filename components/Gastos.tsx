'use client';

// ============================================
// COMPONENTE PRINCIPAL: GASTOS (PASTEL)
// ============================================

import { useState, useEffect } from 'react';
import { Expense, ExpenseFormData, ExpenseFilters } from '@/lib/types';
import { getExpenses, createExpense, updateExpense, deleteExpense, getExpenseStats } from '@/lib/expenseService';
import { exportToCSV } from '@/lib/expenseUtils';
import ExpenseCard from './ExpenseCard';
import ExpenseForm from './ExpenseForm';
import ExpenseFiltersComponent from './ExpenseFilters';
import ExpenseStatsComponent from './ExpenseStats';
import { Plus, Download, Wallet, BarChart3 } from 'lucide-react';
import { ExpenseStats as ExpenseStatsType } from '@/lib/types';
import { PastelCard } from '@/components/ui/PastelCard';
import { useToast } from '@/context/ToastContext';

export default function Gastos() {
    const { showSuccess, showError } = useToast();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [stats, setStats] = useState<ExpenseStatsType | null>(null);
    const [filters, setFilters] = useState<ExpenseFilters>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | undefined>();
    const [showStats, setShowStats] = useState(true);

    // Cargar gastos
    const loadExpenses = async () => {
        try {
            setIsLoading(true);
            const data = await getExpenses(filters);
            setExpenses(data);
        } catch (error) {
            console.error('Error loading expenses:', error);
            showError('Error al cargar gastos');
        } finally {
            setIsLoading(false);
        }
    };

    // Cargar estadísticas
    const loadStats = async () => {
        try {
            const data = await getExpenseStats();
            setStats(data);
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    useEffect(() => {
        loadExpenses();
    }, [filters]);

    useEffect(() => {
        loadStats();
    }, []);


    // Manejar creación/edición
    const handleSubmit = async (data: ExpenseFormData) => {
        try {
            if (editingExpense) {
                await updateExpense(editingExpense.id, data);
                showSuccess('Gasto actualizado correctamente');
            } else {
                await createExpense(data);
                showSuccess('Gasto creado correctamente');
            }
            setIsFormOpen(false);
            setEditingExpense(undefined);
            loadExpenses();
            loadStats();
        } catch (error: unknown) {
            console.error('Error saving expense:', error);
            const err = error as { message?: string; name?: string } | null;
            const isStorageError = err?.message?.includes('Storage') || err?.message?.includes('upload') || err?.name === 'StorageApiError';
            if (isStorageError) {
                showError('No se pudo subir el comprobante. Revisá que sea imagen o PDF y volvé a intentar.');
            } else {
                showError('Error al guardar gasto');
            }
        }
    };

    // Manejar eliminación
    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este gasto?')) return;

        try {
            await deleteExpense(id);
            showSuccess('Gasto eliminado correctamente');
            loadExpenses();
            loadStats();
        } catch (error) {
            console.error('Error deleting expense:', error);
            showError('Error al eliminar gasto');
        }
    };

    // Manejar edición
    const handleEdit = (expense: Expense) => {
        setEditingExpense(expense);
        setIsFormOpen(true);
    };

    // Exportar a CSV
    const handleExport = () => {
        exportToCSV(expenses, `gastos-${new Date().toISOString().split('T')[0]}.csv`);
        showSuccess('Gastos exportados correctamente');
    };

    return (
        <div className="flex flex-col gap-12 animate-fade-in pb-12">
            {/* Header Toolbar */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight mb-2 flex items-center gap-3">
                        <span className="text-pink-500">✦</span>
                        Gestión de Gastos
                    </h1>
                    <p className="text-gray-500 text-sm font-medium mt-1">Controla y optimiza tus egresos de forma simple.</p>
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                    <button
                        onClick={() => setShowStats(!showStats)}
                        className="btn-ghost bg-white shadow-sm border-gray-200 text-gray-600 hover:text-pink-600"
                    >
                        <BarChart3 size={18} />
                        <span className="hidden sm:inline">{showStats ? 'Ocultar' : 'Ver'} Stats</span>
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={expenses.length === 0}
                        className="btn-ghost bg-white shadow-sm border-gray-200 text-gray-600 hover:text-pink-600"
                    >
                        <Download size={18} />
                        <span className="hidden sm:inline">Exportar</span>
                    </button>
                    <button
                        onClick={() => {
                            setEditingExpense(undefined);
                            setIsFormOpen(true);
                        }}
                        className="btn-primary shadow-lg shadow-pink-200"
                    >
                        <Plus size={18} />
                        Nuevo Gasto
                    </button>
                </div>
            </div>

            {/* Estadísticas: se muestra skeleton de inmediato mientras cargan */}
            {showStats && (
                <div className="animate-fade-in">
                    <ExpenseStatsComponent stats={stats} isLoading={!stats} />
                </div>
            )}

            {/* Lista Principal */}
            <div className="flex flex-col gap-10">
                {/* Toolbar de Filtros */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-gray-800">Movimientos</h2>
                        <span className="bg-pink-100 px-2.5 py-1 rounded-full text-xs font-bold text-pink-600">
                            {expenses.length}
                        </span>
                    </div>
                    <ExpenseFiltersComponent filters={filters} onFiltersChange={setFilters} />
                </div>

                {/* Grid de Tarjetas */}
                {isLoading ? (
                    <div className="grid grid-cols-1 gap-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-24 bg-white rounded-3xl border border-pink-100 animate-pulse shadow-sm" />
                        ))}
                    </div>
                ) : expenses.length === 0 ? (
                    <PastelCard className="flex flex-col items-center justify-center py-24 px-10 text-center border-dashed border-gray-300 bg-transparent shadow-none">
                        <div className="w-24 h-24 bg-pink-50 rounded-full flex items-center justify-center mb-6">
                            <Wallet className="w-12 h-12 text-pink-300" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Sin movimientos registrados</h3>
                        <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                            Comienza a registrar tus gastos para visualizar el análisis financiero.
                        </p>
                        <button
                            onClick={() => setIsFormOpen(true)}
                            className="btn-primary"
                        >
                            <Plus size={18} />
                            Crear Primer Gasto
                        </button>
                    </PastelCard>
                ) : (
                    <div className="grid grid-cols-1 gap-8">
                        {expenses.map((expense) => (
                            <ExpenseCard
                                key={expense.id}
                                expense={expense}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Formulario Modal */}
            {isFormOpen && (
                <ExpenseForm
                    expense={editingExpense}
                    onSubmit={handleSubmit}
                    onCancel={() => {
                        setIsFormOpen(false);
                        setEditingExpense(undefined);
                    }}
                    isLoading={isLoading}
                />
            )}

        </div>
    );
}
