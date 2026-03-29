'use client';

// ============================================
// COMPONENTE PRINCIPAL: GASTOS (PASTEL)
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { Expense, ExpenseFormData, ExpenseFilters } from '@/lib/types';
import { getExpenses, createExpense, updateExpense, deleteExpense, getExpenseStats, getExpenseReceiptViewUrl } from '@/lib/expenseService';
import { exportToCSV } from '@/lib/expenseUtils';
import ExpenseCard from './ExpenseCard';
import ExpenseForm from './ExpenseForm';
import ExpenseFiltersComponent from './ExpenseFilters';
import ExpenseStatsComponent from './ExpenseStats';
import Loader from './Loader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Plus, Download, Wallet, BarChart3, Trash2, Filter } from 'lucide-react';
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
    const [mostrarEliminarGastosModal, setMostrarEliminarGastosModal] = useState(false);
    const [gastosSeleccionados, setGastosSeleccionados] = useState<Set<string>>(new Set());
    const [eliminandoGastos, setEliminandoGastos] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [filtersPanelOpen, setFiltersPanelOpen] = useState(false);
    const [receiptPreviewForForm, setReceiptPreviewForForm] = useState<string | null>(null);

    // Cargar gastos
    const loadExpenses = useCallback(async () => {
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
    }, [filters, showError]);

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
    }, [loadExpenses]);

    useEffect(() => {
        loadStats();
    }, []);


    // Manejar creación/edición (evita doble envío deshabilitando el botón mientras guarda)
    const handleSubmit = async (data: ExpenseFormData) => {
        if (isSubmitting) return;
        setIsSubmitting(true);
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
            setReceiptPreviewForForm(null);
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
        } finally {
            setIsSubmitting(false);
        }
    };

    // Manejar eliminación (uno solo, desde la tarjeta)
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

    const toggleSeleccionGasto = (id: string) => {
        setGastosSeleccionados(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const seleccionarTodosGastos = () => {
        if (gastosSeleccionados.size === expenses.length) {
            setGastosSeleccionados(new Set());
        } else {
            setGastosSeleccionados(new Set(expenses.map(e => e.id)));
        }
    };

    const handleEliminarGastosSeleccionados = async () => {
        if (gastosSeleccionados.size === 0) {
            showError('Seleccioná al menos un gasto.');
            return;
        }
        if (!confirm(`¿Eliminar ${gastosSeleccionados.size} gasto(s)? Esta acción no se puede deshacer.`)) return;
        setEliminandoGastos(true);
        try {
            for (const id of gastosSeleccionados) {
                await deleteExpense(id);
            }
            setExpenses(expenses.filter(e => !gastosSeleccionados.has(e.id)));
            setGastosSeleccionados(new Set());
            setMostrarEliminarGastosModal(false);
            loadStats();
            showSuccess('Gastos eliminados correctamente.');
        } catch (error) {
            console.error('Error al eliminar gastos:', error);
            showError('Error al eliminar algunos gastos.');
        } finally {
            setEliminandoGastos(false);
        }
    };

    // Manejar edición
    const handleEdit = async (expense: Expense) => {
        setEditingExpense(expense);
        setReceiptPreviewForForm(null);
        if (expense.receipt_url) {
            const u = await getExpenseReceiptViewUrl(expense);
            setReceiptPreviewForForm(u);
        }
        setIsFormOpen(true);
    };

    // Exportar a CSV
    const handleExport = () => {
        exportToCSV(expenses, `gastos-${new Date().toISOString().split('T')[0]}.csv`);
        showSuccess('Gastos exportados correctamente');
    };

    return (
        <div className="flex flex-col gap-10 animate-fade-in pb-12 text-gray-800 dark:text-gray-100">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800 dark:text-gray-100 tracking-tight flex items-center gap-2.5">
                        <span className="text-pink-500 dark:text-pink-400">✦</span>
                        Gestión de Gastos
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mt-1">Controla y optimiza tus egresos de forma simple.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <button
                        onClick={() => setShowStats(!showStats)}
                        className="btn-ghost bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:text-pink-600 dark:hover:text-pink-400 px-4 py-2.5 text-sm font-medium rounded-xl"
                    >
                        <BarChart3 size={18} />
                        <span className="hidden sm:inline">{showStats ? 'Ocultar' : 'Ver'} Stats</span>
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={expenses.length === 0}
                        className="btn-ghost bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:text-pink-600 dark:hover:text-pink-400 px-4 py-2.5 text-sm font-medium rounded-xl"
                    >
                        <Download size={18} />
                        <span className="hidden sm:inline">Exportar</span>
                    </button>
                    <button
                        onClick={() => { setEditingExpense(undefined); setReceiptPreviewForForm(null); setIsFormOpen(true); }}
                        className="btn-primary shadow-lg shadow-pink-200 px-5 py-2.5 text-sm font-bold rounded-xl gap-2"
                    >
                        <Plus size={18} />
                        Nuevo Gasto
                    </button>
                </div>
            </div>

            {showStats && (
                <div className="animate-fade-in">
                    <ExpenseStatsComponent stats={stats} isLoading={!stats} />
                </div>
            )}

            {/* Movimientos: layout de dos columnas cuando el panel de filtros está abierto */}
            <section className="flex flex-col gap-8">
                <header className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Movimientos</h2>
                            <span className="bg-pink-100 dark:bg-pink-900/40 px-2.5 py-0.5 rounded-lg text-xs font-bold text-pink-600 dark:text-pink-400">
                                {expenses.length}
                            </span>
                            {expenses.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => { setMostrarEliminarGastosModal(true); setGastosSeleccionados(new Set()); }}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 font-semibold text-sm transition-colors"
                                >
                                    <Trash2 size={16} />
                                    Eliminar gastos
                                </button>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setFiltersPanelOpen(prev => !prev)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-medium text-sm border shrink-0 ${Object.keys(filters).length > 0
                                ? 'bg-pink-50 dark:bg-pink-900/40 text-pink-600 dark:text-pink-400 border-pink-200 dark:border-pink-800'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        >
                            <Filter className="w-4 h-4" />
                            Filtros
                            {Object.keys(filters).length > 0 && (
                                <span className="bg-pink-500 dark:bg-pink-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                                    {Object.keys(filters).length}
                                </span>
                            )}
                        </button>
                    </div>
                </header>

                <div className={`flex flex-col ${filtersPanelOpen ? 'lg:flex-row' : ''} gap-6 lg:gap-8`}>
                    <div className="flex-1 min-w-0">
                        {isLoading ? (
                            <div className="flex justify-center py-12">
                                <Loader text="Cargando gastos..." />
                            </div>
                        ) : expenses.length === 0 ? (
                            <EmptyState
                                icon={<Wallet className="w-12 h-12 text-pink-400" />}
                                title="Sin movimientos registrados"
                                description="Comenzá a cargar gastos para ver el análisis y llevar el control."
                                action={
                                    <button onClick={() => setIsFormOpen(true)} className="btn-primary">
                                        <Plus size={18} />
                                        Crear primer gasto
                                    </button>
                                }
                            />
                        ) : (
                            <div className="flex flex-col gap-5">
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

                    {filtersPanelOpen && (
                        <aside className="w-full lg:w-[400px] lg:flex-shrink-0 lg:self-start">
                            <ExpenseFiltersComponent
                                filters={filters}
                                onFiltersChange={setFilters}
                                onClose={() => setFiltersPanelOpen(false)}
                            />
                        </aside>
                    )}
                </div>
            </section>

            {/* Formulario Modal */}
            {isFormOpen && (
                <ExpenseForm
                    expense={editingExpense}
                    storedReceiptPreviewUrl={receiptPreviewForForm}
                    onSubmit={handleSubmit}
                    onCancel={() => {
                        setIsFormOpen(false);
                        setEditingExpense(undefined);
                        setReceiptPreviewForForm(null);
                    }}
                    isLoading={isSubmitting}
                />
            )}

            {/* Modal Eliminar gastos (como historial de ventas / inventario) */}
            {mostrarEliminarGastosModal && (
                <>
                    <div className="modal-backdrop" onClick={() => !eliminandoGastos && setMostrarEliminarGastosModal(false)} />
                    <PastelCard className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col z-[100] !shadow-2xl rounded-3xl border border-gray-200 dark:border-gray-700" noHover>
                        <div className="p-6 border-b border-pink-100 dark:border-gray-700">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Eliminar gastos</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Seleccioná los gastos a eliminar. Esta acción no se puede deshacer.</p>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1 min-h-0">
                            <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-pink-50/50 dark:hover:bg-gray-700/50 cursor-pointer mb-2">
                                <input
                                    type="checkbox"
                                    checked={expenses.length > 0 && gastosSeleccionados.size === expenses.length}
                                    onChange={seleccionarTodosGastos}
                                    className="rounded border-pink-300 text-pink-600 focus:ring-pink-500"
                                />
                                <span className="font-bold text-sm text-gray-700 dark:text-gray-200">Seleccionar todos</span>
                            </label>
                            <div className="space-y-2">
                                {expenses.length === 0 ? (
                                    <p className="text-gray-400 dark:text-gray-500 text-sm py-4">No hay gastos con los filtros actuales.</p>
                                ) : (
                                    expenses.map(expense => (
                                        <label
                                            key={expense.id}
                                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-pink-50/50 dark:hover:bg-gray-700/50 cursor-pointer border border-transparent hover:border-pink-100 dark:hover:border-gray-600"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={gastosSeleccionados.has(expense.id)}
                                                onChange={() => toggleSeleccionGasto(expense.id)}
                                                className="rounded border-pink-300 text-pink-600 focus:ring-pink-500"
                                            />
                                            <span className="flex-1 text-sm text-gray-800 dark:text-gray-100 truncate">{expense.description}</span>
                                            <span className="text-xs text-gray-400 dark:text-gray-400 flex-shrink-0">
                                                {expense.date} · ${expense.amount.toLocaleString()}
                                            </span>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>
                        <div className="p-6 border-t border-pink-100 dark:border-gray-700 flex gap-3 justify-end">
                            <button
                                type="button"
                                onClick={() => setMostrarEliminarGastosModal(false)}
                                disabled={eliminandoGastos}
                                className="btn-ghost"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleEliminarGastosSeleccionados}
                                disabled={eliminandoGastos || gastosSeleccionados.size === 0}
                                className="px-4 py-2.5 rounded-xl font-bold text-sm bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {eliminandoGastos ? 'Eliminando...' : `Eliminar ${gastosSeleccionados.size} gasto(s)`}
                            </button>
                        </div>
                    </PastelCard>
                </>
            )}

        </div>
    );
}
