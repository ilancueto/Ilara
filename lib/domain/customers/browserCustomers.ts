/**
 * Clientes — operaciones browser con RLS (panel autenticado).
 */
import { getBrowserSupabase } from '@/lib/supabase/browser'
import type { Cliente } from '@/lib/domain/types'
import { AppError } from '@/lib/domain/errors'

export const CUSTOMER_LIST_SELECT =
  'id, first_name, last_name, email, phone, created_at' as const

export async function listCustomers(): Promise<Cliente[]> {
  const { data, error } = await getBrowserSupabase()
    .from('customers')
    .select(CUSTOMER_LIST_SELECT)
    .order('first_name')

  if (error) {
    throw new AppError('unknown', 'No se pudieron cargar los clientes.', {
      cause: error,
      message: error.message,
      retryable: true,
    })
  }
  return (data ?? []) as Cliente[]
}

export async function deleteCustomersByIds(ids: number[]): Promise<void> {
  if (ids.length === 0) {
    throw new AppError('validation', 'Seleccioná al menos un cliente.')
  }
  const { error } = await getBrowserSupabase().from('customers').delete().in('id', ids)
  if (error) {
    throw new AppError('unknown', 'Error al eliminar algunos clientes. Podés reintentar.', {
      cause: error,
      message: error.message,
      retryable: true,
    })
  }
}
