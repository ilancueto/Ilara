import { describe, expect, it } from 'vitest'
import {
  buildOrderCustomerEmail,
  isNotifyEmail,
  orderNotifyFulfillment,
} from '@/lib/domain/orders/orderNotify'
import { FULFILLMENT_COPY } from '@/lib/domain/orders/fulfillment'

describe('aviso de pedido al cliente', () => {
  it('arma un mail de pago pendiente de confirmación, sin clave de pago', () => {
    const mail = buildOrderCustomerEmail({
      customerName: 'María',
      customerEmail: 'maria@example.com',
      orderNumber: 'IL-000123',
      total: 5850,
      lines: [{ name: 'Labial', quantity: 1 }],
      fulfillmentMode: 'coordinar',
      followUrl: 'https://ilara.com.ar/pedido/IL-000123?t=followtoken',
    })
    expect(mail.subject).toContain('IL-000123')
    expect(mail.text).toContain('Recibimos el pago')
    expect(mail.text).toContain('Labial')
    expect(mail.text).toContain('https://ilara.com.ar/pedido/IL-000123?t=followtoken')
    expect(mail.text).not.toContain('access_capability')
    expect(mail.html).toContain('Ver el estado del pedido')
    expect(mail.subject).toContain('Recibimos el pago')
  })

  it('cambia el copy según la novedad', () => {
    const ready = buildOrderCustomerEmail({
      customerName: 'María',
      orderNumber: 'IL-000123',
      total: 5850,
      lines: [],
      followUrl: null,
      kind: 'ready',
    })
    expect(ready.subject).toContain('listo')
    expect(ready.text).toContain('está listo')
    const paid = buildOrderCustomerEmail({
      customerName: 'María',
      orderNumber: 'IL-000123',
      total: 5850,
      lines: [],
      followUrl: null,
      kind: 'payment_received',
    })
    expect(paid.subject).toContain('Pago acreditado')
  })

  it('acepta un email válido y usa el copy de entrega a coordinar', () => {
    expect(isNotifyEmail('ana@ilara.com.ar')).toBe(true)
    expect(isNotifyEmail('')).toBe(false)
    expect(orderNotifyFulfillment('coordinar')).toBe(FULFILLMENT_COPY.coordinar.success)
  })
})
