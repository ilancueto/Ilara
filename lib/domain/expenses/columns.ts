/**
 * Columnas explícitas de expenses (evitar select * en superficie de dominio).
 */
export const EXPENSE_LIST_COLUMNS =
  'id, created_at, date, category, description, amount, payment_method, receipt_url, notes, user_id, updated_by' as const
