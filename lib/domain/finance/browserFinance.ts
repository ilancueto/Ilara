'use client'

import { getBrowserSupabase } from '@/lib/supabase/browser'
import type { CreatePayableInput, FinanceSnapshot, SettlementInput } from './types'
import { mapFinanceSnapshot } from './mappers'

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
