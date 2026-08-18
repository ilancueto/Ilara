import { describe, expect, it } from 'vitest'
import {
  buildOrderCustomerEmail,
  isNotifyEmail,
  orderNotifyFulfillment,
} from '@/lib/domain/orders/orderNotify'
import { FULFILLMENT_COPY } from '@/lib/domain/orders/fulfillment'

describe('aviso de pedido al cliente', () => {
  it('arma un mail con el pedido y el enlace, sin clave de pago', () => {
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
    expect(mail.text).toContain('Labial')
    expect(mail.text).toContain('https://ilara.com.ar/pedido/IL-000123?t=followtoken')
    expect(mail.text).not.toContain('access_capability')
    expect(mail.html).toContain('Ver el pedido y pagar')
  })

  it('acepta un email válido y usa el copy de entrega a coordinar', () => {
    expect(isNotifyEmail('ana@ilara.com.ar')).toBe(true)
    expect(isNotifyEmail('')).toBe(false)
    expect(orderNotifyFulfillment('coordinar')).toBe(FULFILLMENT_COPY.coordinar.success)
  })
})
