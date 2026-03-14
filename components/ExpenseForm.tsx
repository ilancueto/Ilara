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
            <PastelCard className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 z-[100] !shadow-2xl" noHover>
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-2xl font-bold text-gray-800 tracking-tight flex items-center gap-3">
                            <span className="text-pink-500">✦</span>
                            {expense ? 'Editar Gasto' : 'Nuevo Gasto'}
                        </h3>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Fecha y Monto en Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className="form-label">Fecha <span className="text-pink-500">*</span></label>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                required
                                className="transition-all"
                            />
                        </div>
                        <div>
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
                                    className="pr-8 transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Descripción */}
                    <div>
                        <label className="form-label">Descripción <span className="text-pink-500">*</span></label>
                        <input
                            type="text"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            required
                            placeholder="Ej: Compra de insumos..."
                            className="transition-all"
                        />
                    </div>

                    {/* Categorías Grid */}
                    <div>
                        <label className="form-label">Categoría <span className="text-pink-500">*</span></label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-2">
                            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, category: key as ExpenseCategory })}
                                    className={`
                                        p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all h-24 relative overflow-hidden
                                        ${formData.category === key
                                            ? 'bg-pink-50 border-pink-200 text-pink-600 shadow-sm ring-1 ring-pink-200'
                                            : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50 hover:border-gray-200 hover:text-gray-600'
                                        }
                                    `}
                                >
                                    <span className={`text-2xl ${formData.category === key ? 'scale-110 text-pink-500' : 'text-gray-300'}`}>
                                        {getCategoryIcon(key as ExpenseCategory)}
                                    </span>
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-center leading-tight">
                                        {label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Método de Pago y Comprobante */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className="form-label">Método de pago <span className="text-pink-500">*</span></label>
                            <select
                                value={formData.payment_method}
                                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as PaymentMethod })}
                                required
                                className="transition-all"
                            >
                                {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
                                    <option key={key} value={key}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="form-label">Comprobante</label>
                            <div className="relative">
                                <input
                                    type="file"
                                    id="receipt-upload"
                                    accept="image/*,application/pdf"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                {receiptPreview ? (
                                    <div className="flex items-center gap-3 p-2 border border-pink-200 rounded-xl bg-pink-50">
                                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-white border border-pink-100 flex-shrink-0">
                                            <Image src={receiptPreview} alt="Preview" width={40} height={40} className="w-full h-full object-cover" unoptimized />
                                        </div>
                                        <span className="text-xs text-pink-700 truncate flex-1">Comprobante cargado</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setReceiptPreview(null);
                                                setFormData({ ...formData, receipt: undefined });
                                            }}
                                            className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <label
                                        htmlFor="receipt-upload"
                                        className="flex items-center justify-center gap-2 p-3 border border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-pink-300 hover:bg-pink-50 transition-all text-gray-400 hover:text-pink-500 text-sm bg-gray-50/50"
                                    >
                                        <Upload size={16} />
                                        <span>Subir archivo</span>
                                    </label>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Notas */}
                    <div>
                        <label className="form-label">Notas</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Información adicional..."
                            rows={2}
                            className="bg-white"
                        />
                    </div>

                    {/* Botones */}
                    <div className="flex gap-4 pt-4 border-t border-gray-100 mt-4">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="btn-ghost flex-1 border-gray-200 text-gray-600 hover:bg-gray-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-primary flex-[2] shadow-lg shadow-pink-200"
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
