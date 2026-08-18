import { AppError } from '@/lib/domain/errors'
import type {
  CustomerConsent,
  CustomerCrmActivity,
  CustomerCrmNote,
  CustomerCrmProfile,
  CustomerCrmTag,
} from './crmTypes'

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
const number = (value: unknown) => Number(value) || 0
const string = (value: unknown) => typeof value === 'string' ? value : ''
const nullableString = (value: unknown) => typeof value === 'string' ? value : null

export function mapCustomerCrmTag(value: unknown): CustomerCrmTag {
  const row = object(value)
  return {
    id: number(row.id),
    name: string(row.name),
    color: string(row.color) || '#ec4899',
    customer_count: row.customer_count == null ? undefined : number(row.customer_count),
  }
}

const mapNote = (value: unknown): CustomerCrmNote => {
  const row = object(value)
  return { id: number(row.id), body: string(row.body), created_at: string(row.created_at) }
}

const mapConsent = (value: unknown): CustomerConsent => {
  const row = object(value)
  return {
    id: row.id == null ? undefined : number(row.id),
    granted: Boolean(row.granted),
    source: nullableString(row.source),
    evidence_note: nullableString(row.evidence_note),
    created_at: nullableString(row.created_at),
  }
}

const mapActivity = (value: unknown): CustomerCrmActivity => {
  const row = object(value)
  const type = row.type === 'return' || row.type === 'order' ? row.type : 'sale'
  return {
    id: string(row.id),
    type,
    event_at: string(row.event_at),
    sale_id: row.sale_id == null ? undefined : number(row.sale_id),
    order_id: row.order_id == null ? undefined : string(row.order_id),
    order_number: row.order_number == null ? undefined : string(row.order_number),
    amount: number(row.amount),
    status: nullableString(row.status),
    payment_method: nullableString(row.payment_method),
    credit_note_number: row.credit_note_number == null ? undefined : number(row.credit_note_number),
    reason: row.reason == null ? undefined : string(row.reason),
  }
}

export function mapCustomerCrmProfile(value: unknown): CustomerCrmProfile {
  const row = object(value)
  const metrics = object(row.metrics)
  const catalog = object(row.catalog_orders)
  return {
    metrics: {
      sale_count: number(metrics.sale_count),
      gross_spent: number(metrics.gross_spent),
      refund_total: number(metrics.refund_total),
      net_spent: number(metrics.net_spent),
      average_ticket: number(metrics.average_ticket),
      first_purchase_at: nullableString(metrics.first_purchase_at),
      last_purchase_at: nullableString(metrics.last_purchase_at),
    },
    catalog_orders: {
      order_count: number(catalog.order_count),
      order_total: number(catalog.order_total),
      last_order_at: nullableString(catalog.last_order_at),
      pending_count: number(catalog.pending_count),
      open_count: number(catalog.open_count),
      completed_count: number(catalog.completed_count),
      cancelled_count: number(catalog.cancelled_count),
      recent: (Array.isArray(catalog.recent) ? catalog.recent : []).map((raw) => {
        const item = object(raw)
        return {
          id: string(item.id),
          order_number: string(item.order_number),
          status: string(item.status),
          total: number(item.total),
          created_at: string(item.created_at),
        }
      }),
    },
    tags: (Array.isArray(row.tags) ? row.tags : []).map(mapCustomerCrmTag),
    notes: (Array.isArray(row.notes) ? row.notes : []).map(mapNote),
    consent: mapConsent(row.consent),
    consent_history: (Array.isArray(row.consent_history) ? row.consent_history : []).map(mapConsent),
    activity: (Array.isArray(row.activity) ? row.activity : []).map(mapActivity),
  }
}

export function customerCrmError(message: string): AppError {
  if (/forbidden|42501/i.test(message)) {
    return new AppError('forbidden', 'Sólo un administrador puede usar el CRM.', { message: 'forbidden' })
  }
  if (/not_found|P0002/i.test(message)) {
    return new AppError('not_found', 'El cliente o registro ya no existe.', { message: 'crm_not_found' })
  }
  if (/name_exists|23505/i.test(message)) {
    return new AppError('conflict', 'Ya existe una etiqueta con ese nombre.', { message: 'tag_exists' })
  }
  if (/invalid_/i.test(message)) {
    return new AppError('validation', 'Revisá los datos ingresados.', { message: 'invalid_crm_data' })
  }
  return new AppError('unknown', 'No se pudo actualizar el CRM.', {
    message: 'customer_crm_failed', retryable: true,
  })
}
