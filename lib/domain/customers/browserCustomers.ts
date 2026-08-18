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

function splitCustomerName(name: string): { first_name: string; last_name: string } {
  const trimmed = name.trim()
  const first = trimmed.split(/\s+/).find(Boolean) || 'Cliente'
  const last = trimmed.slice(first.length).trim() || '.'
  return { first_name: first, last_name: last }
}

export async function findOrCreateCustomerFromContact(input: {
  name: string
  phone?: string | null
  email?: string | null
}): Promise<Cliente> {
  const phone = (input.phone || '').replace(/\D/g, '') || null
  const email = input.email?.trim() || null
  const supabase = getBrowserSupabase()

  if (phone && phone.length >= 8) {
    const { data: existing } = await supabase
      .from('customers')
      .select(CUSTOMER_LIST_SELECT)
      .eq('phone', phone)
      .limit(1)
      .maybeSingle()
    if (existing) return existing as Cliente
  }

  const { first_name, last_name } = splitCustomerName(input.name)
  const { data, error } = await supabase
    .from('customers')
    .insert({ first_name, last_name, phone, email })
    .select(CUSTOMER_LIST_SELECT)
    .single()

  if (error || !data) {
    throw new AppError('unknown', 'No se pudo registrar a la clienta.', {
      cause: error,
      message: error?.message,
      retryable: true,
    })
  }
  return data as Cliente
}

export async function createQuickCustomer(input: {
  first_name: string
  last_name?: string
  phone?: string | null
}): Promise<Cliente> {
  const first_name = input.first_name.trim()
  if (first_name.length < 2) {
    throw new AppError('validation', 'Escribí el nombre de la clienta.')
  }
  const { data, error } = await getBrowserSupabase()
    .from('customers')
    .insert({
      first_name,
      last_name: (input.last_name || '').trim() || '.',
      phone: input.phone?.replace(/\D/g, '') || null,
    })
    .select(CUSTOMER_LIST_SELECT)
    .single()
  if (error || !data) {
    throw new AppError('unknown', 'No se pudo crear la clienta.', {
      cause: error,
      message: error?.message,
      retryable: true,
    })
  }
  return data as Cliente
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
