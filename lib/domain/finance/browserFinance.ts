'use client'

import { getBrowserSupabase } from '@/lib/supabase/browser'
import type { CreatePayableInput, FinanceSnapshot, SettlementInput } from './types'
import { mapFinanceSnapshot } from './mappers'
import { mapCatalogFinanceSlice, type CatalogFinanceSlice } from '@/lib/domain/payments/finance'

export type CatalogCollectionItem = {
  id: string
  order_number: string
  customer_name: string
  method: string
  status: string
  amount_due: number
  approved_at: string | null
  created_at: string
}

export type CatalogCollections = {
  total: number
  count: number
  items: CatalogCollectionItem[]
}

export async function listCatalogCollections(from?: string, to?: string): Promise<CatalogCollections> {
  const { data, error } = await getBrowserSupabase().rpc('admin_list_catalog_collections', {
    p_from: from || null,
    p_to: to || null,
  })
  if (error) throw error
  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  const items = Array.isArray(raw.items) ? raw.items : []
  return {
    total: Number(raw.total) || 0,
    count: Number(raw.count) || 0,
    items: items.map((item) => {
      const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
      return {
        id: String(row.id || ''),
        order_number: String(row.order_number || ''),
        customer_name: String(row.customer_name || ''),
        method: String(row.method || ''),
        status: String(row.status || ''),
        amount_due: Number(row.amount_due) || 0,
        approved_at: row.approved_at == null ? null : String(row.approved_at),
        created_at: String(row.created_at || ''),
      }
    }),
  }
}

export async function getCatalogPaymentSlice(from: string, to: string): Promise<CatalogFinanceSlice> {
  const { data, error } = await getBrowserSupabase().rpc('finance_stage8_payments_slice', {
    p_from: from,
    p_to: to,
  })
  if (error) throw error
  return mapCatalogFinanceSlice(data)
}

export async function getFinanceSnapshot(from: string, to: string): Promise<FinanceSnapshot> {
  const { data, error } = await getBrowserSupabase().rpc('finance_stage66_snapshot', {
    p_from: from,
    p_to: to,
  })
  if (error) throw error
  return mapFinanceSnapshot(data)
}

export async function createPayable(input: CreatePayableInput): Promise<void> {
  const { error } = await getBrowserSupabase().rpc('finance_create_payable', {
    p_counterparty: input.counterparty,
    p_description: input.description,
    p_amount: input.amount,
    p_due_date: input.dueDate || null,
  })
  if (error) throw error
}

export async function recordSettlement(input: SettlementInput): Promise<void> {
  const { error } = await getBrowserSupabase().rpc('finance_record_settlement', {
    p_account_id: input.accountId,
    p_amount: input.amount,
    p_payment_method: input.paymentMethod,
    p_occurred_at: input.occurredAt,
    p_note: input.note || null,
    p_idempotency_key: input.idempotencyKey,
  })
  if (error) throw error
}

export async function cancelPayable(accountId: string, reason: string): Promise<void> {
  const { error } = await getBrowserSupabase().rpc('finance_cancel_payable', {
    p_account_id: accountId,
    p_reason: reason,
  })
  if (error) throw error
}
