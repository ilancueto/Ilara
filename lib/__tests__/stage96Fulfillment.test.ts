import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildCreateOrderPayload, createOrderErrorFromRpc } from '@/lib/domain/orders/createOrder'
import { normalizeCreateOrderInput } from '@/lib/domain/orders/validation'
import { FULFILLMENT_COPY, fulfillmentPublicLine } from '@/lib/domain/orders/fulfillment'
import { buildTransferWhatsAppMessage } from '@/lib/domain/orders/whatsappMessage'
import { AppError } from '@/lib/domain/errors'

const migration = readFileSync(
  join(__dirname, '../../supabase/migrations/20260818034000_stage96_fulfillment_pickup.sql'),
  'utf8'
)
const checkout = readFileSync(
  join(__dirname, '../../components/Catalogo/CheckoutPedido.tsx'),
  'utf8'
)
const payment = readFileSync(
  join(__dirname, '../../components/Catalogo/PedidoPagoClient.tsx'),
  'utf8'
)

describe('Stage 9.6 — retiro y a coordinar', () => {
  it('agrega fulfillment_mode y no reescribe pedidos viejos', () => {
    expect(migration).toContain("fulfillment_mode text NOT NULL DEFAULT 'envio'")
    expect(migration).toContain("'envio', 'retiro', 'coordinar'")
    expect(migration).not.toMatch(/UPDATE\s+public\.orders\s+SET\s+sale_price/i)
    expect(migration).toContain("SET search_path = ''")
    expect(migration).toContain('create_catalog_order_core_stage61')
    expect(migration).toContain('create_catalog_order_core_stage72')
  })

  it('el checkout ofrece las tres formas de entrega', () => {
    expect(checkout).toContain('fulfillment-options')
    expect(checkout).toContain('fulfillment-${mode}')
    expect(checkout).toContain('FULFILLMENT_COPY[mode].title')
    expect(FULFILLMENT_COPY.retiro.title).toBe('Retiro en el local')
    expect(FULFILLMENT_COPY.coordinar.title).toBe('A coordinar')
    expect(checkout).not.toContain('Origen: Neuquén')
    expect(
      fulfillmentPublicLine({
        mode: 'coordinar',
        carrier: 'A coordinar',
        service: 'Por WhatsApp',
        estimate: 'Lo coordinamos por WhatsApp',
      })
    ).toBe(FULFILLMENT_COPY.coordinar.success)
    expect(
      fulfillmentPublicLine({
        mode: 'retiro',
        carrier: 'Retiro en el local',
        service: 'En el local',
        estimate: 'Horario a coordinar',
      })
    ).toBe(FULFILLMENT_COPY.retiro.success)
  })

  it('retiro no manda cotización ni importe de envío', () => {
    const payload = buildCreateOrderPayload({
      idempotency_key: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      fulfillment_mode: 'retiro',
      customer_name: 'Ana',
      customer_phone: '2995551234',
      lines: [{ line_type: 'product', product_id: 1, quantity: 1 }],
    })
    expect(payload.fulfillment_mode).toBe('retiro')
    expect(payload).not.toHaveProperty('shipping_quote_id')
    expect(payload).not.toHaveProperty('shipping_amount')
    expect(payload).not.toHaveProperty('total')
  })

  it('envio sigue exigiendo cotización', () => {
    expect(() =>
      normalizeCreateOrderInput({
        idempotency_key: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        fulfillment_mode: 'envio',
        customer_name: 'Ana',
        customer_phone: '2995551234',
        lines: [{ line_type: 'product', product_id: 1, quantity: 1 }],
      })
    ).toThrow(AppError)
  })

  it('mapea el conflicto de cotización sin jerga interna', () => {
    expect(createOrderErrorFromRpc('fulfillment_shipping_conflict').userMessage).toContain('cotización')
  })
})

describe('Stage 9.6 — transferencia visible', () => {
  it('la pantalla de pago ofrece transferencia aunque el cobro online esté apagado', () => {
    expect(payment).toContain('pay-transfer-whatsapp')
    expect(payment).toContain('buildTransferWhatsAppMessage')
    expect(buildTransferWhatsAppMessage({ order_number: 'IL-000001', amount: 90000 })).toContain('IL-000001')
    expect(buildTransferWhatsAppMessage({ order_number: 'IL-000001', amount: 90000 })).toContain('transferencia')
    expect(buildTransferWhatsAppMessage({ order_number: 'IL-000001', amount: 90000 })).not.toContain('CBU:')
  })
})
