import { describe, expect, it } from 'vitest'
import { orderWhatsAppMessage, whatsappContactDigits } from '@/lib/domain/orders/orderWhatsApp'

describe('orderWhatsAppMessage', () => {
  it('uses the first name and confirmed copy', () => {
    expect(
      orderWhatsAppMessage({
        customerName: 'María López',
        orderNumber: 'IL-000123',
        status: 'confirmed',
        fulfillmentMode: 'envio',
      })
    ).toBe('¡Hola María! Confirmamos tu pedido IL-000123. Ya lo estamos preparando.')
  })

  it('uses pickup copy when ready', () => {
    expect(
      orderWhatsAppMessage({
        customerName: 'Ana',
        orderNumber: 'IL-000124',
        status: 'ready',
        fulfillmentMode: 'retiro',
      })
    ).toContain('listo para que pases a retirarlo')
  })

  it('uses dispatched copy when completed with delivery', () => {
    expect(
      orderWhatsAppMessage({
        customerName: 'Sofía',
        orderNumber: 'IL-000125',
        status: 'completed',
        fulfillmentMode: 'envio',
      })
    ).toContain('fue despachado')
  })
})

describe('whatsappContactDigits', () => {
  it('prefixes Argentina country code', () => {
    expect(whatsappContactDigits('2995550188')).toBe('542995550188')
    expect(whatsappContactDigits('+54 9 299 555-0188')).toBe('5492995550188')
  })
})
