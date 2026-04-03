// ============================================
// TIPOS PARA GESTIÓN DE GASTOS
// ============================================

export type PaymentMethod =
    | 'efectivo'
    | 'transferencia'
    | 'tarjeta_debito'
    | 'tarjeta_credito'
    | 'mercadopago'
    | 'otro';

export type ExpenseCategory =
    | 'inventario'
    | 'alquiler'
    | 'servicios'
    | 'marketing'
    | 'envios'
    | 'mantenimiento'
    | 'administrativos'
    | 'personal'
    | 'capacitacion'
    | 'otros';

export interface Expense {
    id: string;
    created_at: string;
    date: string;
    category: ExpenseCategory;
    description: string;
    amount: number;
    payment_method: PaymentMethod;
    receipt_url?: string;
    notes?: string;
    user_id: string;
    /** Usuario que editó por última vez. Requiere supabase/sql/supabase_audit_columns.sql */
    updated_by?: string | null;
}

export interface ExpenseFormData {
    date: string;
    category: ExpenseCategory;
    description: string;
    amount: number;
    payment_method: PaymentMethod;
    receipt?: File;
    notes?: string;
}

export interface ExpenseFilters {
    dateFrom?: string;
    dateTo?: string;
    category?: ExpenseCategory;
    paymentMethod?: PaymentMethod;
    minAmount?: number;
    maxAmount?: number;
}

export interface ExpenseStats {
    totalMonth: number;
    totalPrevMonth: number;
    percentageChange: number;
    byCategory: { category: ExpenseCategory; total: number; count: number }[];
    trend: { month: string; total: number }[];
    topCategories: { category: ExpenseCategory; total: number }[];
}

// Labels para las categorías
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
    inventario: 'Compras de Inventario',
    alquiler: 'Alquiler/Local',
    servicios: 'Servicios',
    marketing: 'Marketing y Publicidad',
    envios: 'Envíos y Logística',
    mantenimiento: 'Mantenimiento',
    administrativos: 'Administrativos',
    personal: 'Personal/Salarios',
    capacitacion: 'Capacitación',
    otros: 'Otros',
};

// ============================================
// TIPOS PARA INGRESOS (no ventas)
// ============================================

export type IncomeType = 'regalo' | 'donacion' | 'ventas_anteriores' | 'otro';

export interface Income {
    id: string;
    created_at: string;
    date: string;
    amount: number;
    type: IncomeType;
    description: string;
    notes?: string;
    user_id: string;
    updated_by?: string | null;
}

export interface IncomeFormData {
    date: string;
    amount: number;
    type: IncomeType;
    description: string;
    notes?: string;
}

export interface IncomeFilters {
    dateFrom?: string;
    dateTo?: string;
    type?: IncomeType;
    /** Filtrar por fecha de creación (ISO). Ej: ingresos cargados en los últimos 7 días */
    createdFrom?: string;
    createdTo?: string;
}

export const INCOME_TYPE_LABELS: Record<IncomeType, string> = {
    regalo: 'Regalo',
    donacion: 'Donación',
    ventas_anteriores: 'Ventas anteriores al sistema',
    otro: 'Otro',
};

// Labels para métodos de pago
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    tarjeta_debito: 'Tarjeta de Débito',
    tarjeta_credito: 'Tarjeta de Crédito',
    mercadopago: 'MercadoPago',
    otro: 'Otro',
};
