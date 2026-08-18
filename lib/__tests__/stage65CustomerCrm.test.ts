import { describe, expect, it } from 'vitest'
import { customerCrmError, mapCustomerCrmProfile, mapCustomerCrmTag } from '@/lib/domain/customers/crmMappers'

describe('Stage 6.5 CRM de clientes', () => {
  it('mapea métricas numéricas, consentimiento e historial', () => {
    const profile = mapCustomerCrmProfile({
      metrics: { sale_count: '2', gross_spent: '3000', refund_total: '500', net_spent: '2500', average_ticket: '1250' },
      tags: [{ id: '3', name: 'VIP', color: '#ec4899' }],
      notes: [{ id: '4', body: 'Prefiere retiro', created_at: '2026-08-13T10:00:00Z' }],
      consent: { granted: true, source: 'whatsapp', created_at: '2026-08-13T10:00:00Z' },
      consent_history: [],
      activity: [{ id: 'return-x', type: 'return', event_at: '2026-08-13', sale_id: 9, amount: '-500', credit_note_number: '7' }],
    })
    expect(profile.metrics.net_spent).toBe(2500)
    expect(profile.catalog_orders.order_count).toBe(0)
    expect(profile.tags[0].id).toBe(3)
    expect(profile.consent.granted).toBe(true)
    expect(profile.activity[0].amount).toBe(-500)
    expect(profile.activity[0].type).toBe('return')
  })

  it('usa defaults seguros ante arrays o consentimiento ausentes', () => {
    const profile = mapCustomerCrmProfile({ metrics: {} })
    expect(profile.tags).toEqual([])
    expect(profile.notes).toEqual([])
    expect(profile.consent.granted).toBe(false)
    expect(profile.metrics.sale_count).toBe(0)
  })

  it('mapea etiquetas y errores sin filtrar detalles internos', () => {
    expect(mapCustomerCrmTag({ id: '2', name: 'Frecuente', color: '' })).toEqual({
      id: 2, name: 'Frecuente', color: '#ec4899', customer_count: undefined,
    })
    expect(customerCrmError('forbidden').code).toBe('forbidden')
    expect(customerCrmError('customer_tag_name_exists').code).toBe('conflict')
    expect(customerCrmError('invalid_customer_note').code).toBe('validation')
  })
})
