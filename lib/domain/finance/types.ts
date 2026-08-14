import type { PaymentMethod } from '@/lib/types'

export type FinancialAccountKind = 'receivable' | 'payable'
export type FinancialAccountStatus = 'open' | 'partial' | 'settled' | 'cancelled'

export type FinancialMovement = {
  id: string
  amount: number
  payment_method: PaymentMethod
  occurred_at: string
  note: string | null
  created_by: string
}

export type FinancialAccount = {
  id: string
  kind: FinancialAccountKind
  sale_id: number | null
  customer_id: number | null
  counterparty: string | null
  description: string
  original_amount: number
  net_amount: number
  paid_amount: number
  balance: number
  due_date: string | null
  status: FinancialAccountStatus
  created_at: string
  movements: FinancialMovement[]
}

export type ReconciliationLine = {
  payment_method: PaymentMethod
  inflow: number
  outflow: number
  net: number
}

export type FinanceSnapshot = {
  period: { from: string; to: string }
  summary: {
    receivable_open: number
    payable_open: number
    period_inflow: number
    period_outflow: number
  }
  accounts: FinancialAccount[]
  reconciliation: ReconciliationLine[]
}

export type CreatePayableInput = {
  counterparty: string
  description: string
  amount: number
  dueDate?: string | null
}

export type SettlementInput = {
  accountId: string
  amount: number
  paymentMethod: PaymentMethod
  occurredAt: string
  note?: string | null
  idempotencyKey: string
}
