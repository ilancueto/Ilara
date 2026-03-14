'use client';

import { createPortal } from 'react-dom';
import Image from 'next/image';
import { ExpenseFormData, ExpenseCategory, PaymentMethod, EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS, Expense } from '@/lib/types';
import { getCategoryIcon } from '@/lib/expenseUtils';
import { X, Upload, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { PastelCard } from '@/components/ui/PastelCard';

interface ExpenseFormProps {
    expense?: Expense;
    onSubmit: (data: ExpenseFormData) => void;
    onCancel: () => void;
    isLoading?: boolean;
}

export default function ExpenseForm({ expense, onSubmit, onCancel, isLoading }: ExpenseFormProps) {
    const [formData, setFormData] = useState<ExpenseFormData>({
        date: expense?.date || new Date().toISOString().split('T')[0],
        category: expense?.category || 'otros',
        description: expense?.description || '',
        amount: expense?.amount || 0,
        payment_method: expense?.payment_method || 'efectivo',
        notes: expense?.notes || '',
    });

    const [receiptPreview, setReceiptPreview] = useState<string | null>(expense?.receipt_url || null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFormData({ ...formData, receipt: file });
            const reader = new FileReader();
            reader.onloadend = () => {
                setReceiptPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    const [mounted, setMounted] = useState(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard for modal
    useEffect(() => setMounted(true), []);

    const modalContent = (
        <>
            <div className="modal-backdrop" onClick={onCancel} />
            <PastelCard className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col z-[100] !shadow-2xl rounded-3xl border border-gray-200 dark:border-gray-700" noHover>
                <div className="flex items-center justify-between flex-shrink-0 p-5 sm:p-6 border-b border-gray-100 dark:border-gray-700">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 tracking-tight flex items-center gap-2">
                        <span className="text-pink-500 dark:text-pink-400">✦</span>
                        {expense ? 'Editar Gasto' : 'Nuevo Gasto'}
                    </h3>
                    <button
                        onClick={onCancel}
                        className="p-2 rounded-xl text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        aria-label="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 flex flex-col gap-6">
                        {/* Fecha y monto */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="form-label">Fecha <span className="text-pink-500">*</span></label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    required
                                    className="transition-all rounded-xl"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="form-label">Monto <span className="text-pink-500">*</span></label>
                                <div className="relative">
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                    <input
                                        type="number"
                                        value={formData.amount || ''}
                                        onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                                        required
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        className="pr-8 transition-all rounded-xl"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Descripción */}
                        <div className="flex flex-col gap-2">
                            <label className="form-label">Descripción <span className="text-pink-500">*</span></label>
                            <input
                                type="text"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                required
                                placeholder="Ej: Compra de insumos..."
                                className="transition-all rounded-xl"
                            />
                        </div>

                        {/* Categoría */}
                        <div className="flex flex-col gap-3">
                            <label className="form-label">Categoría <span className="text-pink-500">*</span></label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, category: key as ExpenseCategory })}
                                        className={`
                                            p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all min-h-[72px]
                                            ${formData.category === key
                                                ? 'bg-pink-50 dark:bg-pink-900/40 border-pink-200 dark:border-pink-700 text-pink-600 dark:text-pink-400 ring-1 ring-pink-200 dark:ring-pink-700'
                                                : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-600 text-gray-400 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-200 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-200'
                                            }
                                        `}
                                    >
                                        <span className={`text-xl ${formData.category === key ? 'text-pink-500 dark:text-pink-400' : 'text-gray-300 dark:text-gray-500'}`}>
                                            {getCategoryIcon(key as ExpenseCategory)}
                                        </span>
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-center leading-tight">
                                            {label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Método de pago y comprobante */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="form-label">Método de pago <span className="text-pink-500">*</span></label>
                                <select
                                    value={formData.payment_method}
                                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as PaymentMethod })}
                                    required
                                    className="transition-all rounded-xl"
                                >
                                    {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="form-label">Comprobante</label>
                                <input
                                    type="file"
                                    id="receipt-upload"
                                    accept="image/*,application/pdf"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                {receiptPreview ? (
                                    <div className="flex items-center gap-3 p-3 rounded-xl border border-pink-200 dark:border-pink-800 bg-pink-50/80 dark:bg-pink-900/30">
                                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-white dark:bg-gray-700 flex-shrink-0">
                                            <Image src={receiptPreview} alt="Preview" width={48} height={48} className="w-full h-full object-cover" unoptimized />
                                        </div>
                                        <span className="text-sm font-medium text-pink-700 dark:text-pink-300 truncate flex-1 min-w-0">Comprobante cargado</span>
                                        <button
                                            type="button"
                                            onClick={() => { setReceiptPreview(null); setFormData({ ...formData, receipt: undefined }); }}
                                            className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 dark:text-red-400 transition-colors flex-shrink-0"
                                            aria-label="Quitar comprobante"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ) : (
                                    <label
                                        htmlFor="receipt-upload"
                                        className="flex items-center justify-center gap-2.5 min-h-[52px] py-3 px-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-800/80 cursor-pointer hover:border-pink-300 dark:hover:border-pink-600 hover:bg-pink-50/50 dark:hover:bg-pink-900/20 transition-all text-gray-500 dark:text-gray-400 hover:text-pink-500 dark:hover:text-pink-400 text-sm font-medium"
                                    >
                                        <Upload size={20} />
                                        <span>Subir imagen o PDF</span>
                                    </label>
                                )}
                            </div>
                        </div>

                        {/* Notas */}
                        <div className="flex flex-col gap-2">
                            <label className="form-label">Notas</label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Información adicional..."
                                rows={2}
                                className="bg-white dark:bg-gray-800 rounded-xl resize-none"
                            />
                        </div>
                    </div>

                    <div className="flex-shrink-0 p-5 sm:p-6 pt-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 flex gap-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="btn-ghost flex-1 py-3 rounded-xl border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-primary flex-[2] py-3 rounded-xl shadow-lg shadow-pink-200 dark:shadow-pink-900/30 font-semibold"
                        >
                            {isLoading ? 'Guardando...' : expense ? 'Guardar Cambios' : 'Crear Gasto'}
                        </button>
                    </div>
                </form>
            </PastelCard>
        </>
    );

    if (!mounted || typeof document === 'undefined') return null;
    return createPortal(modalContent, document.body);
}
