import type { FinanceSnapshot, FinancialAccount, FinancialMovement, ReconciliationLine } from './types'

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {}
const rows = (value: unknown): unknown[] => Array.isArray(value) ? value : []
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0

export function mapFinanceSnapshot(raw: unknown): FinanceSnapshot {
  const source = record(raw)
  const period = record(source.period)
  const summary = record(source.summary)
  return {
    period: { from: String(period.from ?? ''), to: String(period.to ?? '') },
    summary: {
      receivable_open: number(summary.receivable_open),
      payable_open: number(summary.payable_open),
      period_inflow: number(summary.period_inflow),
      period_outflow: number(summary.period_outflow),
    },
    accounts: rows(source.accounts).map((item): FinancialAccount => {
      const account = record(item)
      return {
        id: String(account.id ?? ''),
        kind: account.kind === 'payable' ? 'payable' : 'receivable',
        sale_id: account.sale_id == null ? null : number(account.sale_id),
        customer_id: account.customer_id == null ? null : number(account.customer_id),
        counterparty: account.counterparty == null ? null : String(account.counterparty),
        description: String(account.description ?? ''),
        original_amount: number(account.original_amount),
        net_amount: number(account.net_amount),
        paid_amount: number(account.paid_amount),
        balance: number(account.balance),
        due_date: account.due_date == null ? null : String(account.due_date),
        status: account.status === 'partial' || account.status === 'settled' || account.status === 'cancelled' ? account.status : 'open',
        created_at: String(account.created_at ?? ''),
        movements: rows(account.movements).map((item): FinancialMovement => {
          const movement = record(item)
          return {
            id: String(movement.id ?? ''), amount: number(movement.amount),
            payment_method: String(movement.payment_method ?? 'otro') as FinancialMovement['payment_method'],
            occurred_at: String(movement.occurred_at ?? ''),
            note: movement.note == null ? null : String(movement.note),
            created_by: String(movement.created_by ?? ''),
          }
        }),
      }
    }),
    reconciliation: rows(source.reconciliation).map((item): ReconciliationLine => {
      const line = record(item)
      return {
        payment_method: String(line.payment_method ?? 'otro') as ReconciliationLine['payment_method'],
        inflow: number(line.inflow), outflow: number(line.outflow), net: number(line.net),
      }
    }),
  }
}
