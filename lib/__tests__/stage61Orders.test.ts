import { describe, it, expect } from 'vitest'
import {
  canTransitionOrder,
  isTerminalOrderStatus,
  ORDER_TRANSITIONS,
  transitionMayRestoreStock,
  transitionReservesStock,
  orderStatusLabel,
} from '../domain/orders/states'
import {
  buildCreateOrderPayload,
  createOrderErrorFromRpc,
  parseCreateOrderRpcResult,
} from '../domain/orders/createOrder'
import {
  isValidOrderPhone,
  normalizePhoneDigits,
  normalizeCreateOrderInput,
  sanitizeOrderSearchQuery,
} from '../domain/orders/validation'
import { buildOrderWhatsAppMessage } from '../domain/orders/whatsappMessage'
import { mapOrderListItem, mapOrderItemRow } from '../domain/orders/mappers'
import { AppError } from '../domain/errors'
import {
  cartSubtotal,
  couponDiscountFromPercent,
  priceWithProductDiscount,
  totalAfterCoupon,
} from '../catalogPricing'

describe('Stage 6.1 — máquina de estados', () => {
  it('permite pending → confirmed / cancelled', () => {
    expect(canTransitionOrder('pending', 'confirmed')).toBe(true)
    expect(canTransitionOrder('pending', 'cancelled')).toBe(true)
    expect(canTransitionOrder('pending', 'completed')).toBe(false)
  })

  it('terminales no tienen salidas (salvo idempotente same)', () => {
    expect(isTerminalOrderStatus('completed')).toBe(true)
    expect(isTerminalOrderStatus('cancelled')).toBe(true)
    expect(ORDER_TRANSITIONS.completed).toEqual([])
    expect(canTransitionOrder('completed', 'completed')).toBe(true)
    expect(canTransitionOrder('completed', 'pending')).toBe(false)
  })

  it('marca reserva y restore de stock según transición', () => {
    expect(transitionReservesStock('pending', 'confirmed')).toBe(true)
    expect(transitionReservesStock('confirmed', 'preparing')).toBe(false)
    expect(transitionMayRestoreStock('confirmed', 'cancelled')).toBe(true)
    expect(transitionMayRestoreStock('pending', 'cancelled')).toBe(false)
  })

  it('labels en español', () => {
    expect(orderStatusLabel('ready')).toBe('Listo')
  })
})

describe('Stage 6.1 — validación y payload', () => {
  const base = {
    idempotency_key: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    shipping_quote_id: '11111111-1111-4111-8111-111111111111',
    customer_name: 'Ana',
    customer_phone: '299 555 1234',
    lines: [{ line_type: 'product' as const, product_id: 1, quantity: 2 }],
  }

  it('normaliza teléfono a dígitos', () => {
    expect(normalizePhoneDigits('+54 9 299-555')).toBe('549299555')
    expect(isValidOrderPhone('29955512')).toBe(true)
    expect(isValidOrderPhone('123')).toBe(false)
  })

  it('sanitiza búsqueda antes de interpolarla en filtros PostgREST', () => {
    expect(sanitizeOrderSearchQuery(' IL-000001,customer_name.eq.hacker() ')).toBe(
      'IL-000001 customer name eq hacker'
    )
    expect(sanitizeOrderSearchQuery('José Pérez')).toBe('José Pérez')
  })

  it('payload no incluye total/unit_price del cliente', () => {
    const payload = buildCreateOrderPayload({
      ...base,
      coupon_code: 'promo10',
    })
    expect(payload).not.toHaveProperty('total')
    expect(payload).not.toHaveProperty('subtotal')
    expect(payload).not.toHaveProperty('unit_price')
    expect(payload.shipping_quote_id).toBe('11111111-1111-4111-8111-111111111111')
    expect(payload.customer_phone).toBe('2995551234')
    expect(payload.coupon_code).toBe('PROMO10')
    expect(payload.lines).toEqual([{ line_type: 'product', product_id: 1, quantity: 2 }])
  })

  it('rechaza carrito vacío y cantidad inválida', () => {
    expect(() =>
      normalizeCreateOrderInput({ ...base, lines: [] })
    ).toThrow(AppError)
    expect(() =>
      normalizeCreateOrderInput({
        ...base,
        lines: [{ line_type: 'product', product_id: 1, quantity: 0 }],
      })
    ).toThrow(AppError)
  })

  it('parsea resultado RPC', () => {
    const r = parseCreateOrderRpcResult({
      order_id: '11111111-1111-1111-1111-111111111111',
      order_number: 'IL-000001',
      status: 'pending',
      subtotal: 1000,
      discount_total: 100,
      shipping_amount: 500,
      shipping_currency: 'ARS',
      shipping_carrier: 'OCA',
      shipping_service: 'Puerta a puerta',
      shipping_delivery_estimate: '3-5 días',
      shipping_destination_postal_code: '1000',
      shipping_destination_city: 'Buenos Aires',
      shipping_destination_state: 'Comuna 1',
      total: 900,
      created_at: '2026-08-13T00:00:00Z',
      idempotent_replay: false,
    })
    expect(r.order_number).toBe('IL-000001')
    expect(r.total).toBe(900)
  })
})

describe('Stage 6.1 — precios catálogo (espejo de reglas)', () => {
  it('descuento producto + cupón sobre subtotal', () => {
    const unit = priceWithProductDiscount(1000, 10) // 900
    const sub = cartSubtotal([{ unitPrice: unit, quantity: 2 }]) // 1800
    const disc = couponDiscountFromPercent(sub, 10) // 180
    expect(totalAfterCoupon(sub, disc)).toBe(1620)
  })
})

describe('Stage 6.1 — errores RPC sanitizados', () => {
  it('mapea cupón, rate limit, idempotencia y stock', () => {
    expect(createOrderErrorFromRpc('invalid_coupon').code).toBe('validation')
    expect(createOrderErrorFromRpc('rate_limited').retryable).toBe(true)
    expect(createOrderErrorFromRpc('insufficient_stock').code).toBe('stock')
    expect(createOrderErrorFromRpc('product_not_available').code).toBe('conflict')
    expect(createOrderErrorFromRpc('idempotency_conflict').code).toBe('conflict')
  })
})

describe('Stage 6.1 — WhatsApp y mappers', () => {
  it('mensaje incluye número y total sin IDs internos', () => {
    const msg = buildOrderWhatsAppMessage({
      order_number: 'IL-000042',
      total: 2500,
      customer_name: 'Mara',
      lines: [{ name: 'Labial', quantity: 1 }],
    })
    expect(msg).toContain('IL-000042')
    expect(msg).toContain('Labial')
    expect(msg).not.toContain('order_id')
    expect(msg).not.toContain('uuid')
  })

  it('mapOrderListItem no inventa channel logístico', () => {
    const row = mapOrderListItem({
      id: 'x',
      order_number: 'IL-000002',
      status: 'pending',
      channel: 'catalog',
      customer_name: 'A',
      customer_phone: '2991111111',
      customer_email: null,
      notes: null,
      subtotal: 10,
      discount_total: 0,
      total: 10,
      coupon_code: null,
      coupon_discount_percentage: null,
      stock_reserved: false,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      confirmed_at: null,
      completed_at: null,
      cancelled_at: null,
      cancel_reason: null,
    })
    expect(row.channel).toBe('catalog')
  })

  it('mapOrderItemRow parsea snapshot de combo', () => {
    const item = mapOrderItemRow({
      id: 1,
      order_id: 'o',
      line_type: 'combo',
      product_id: null,
      combo_id: 3,
      name_snapshot: 'Kit',
      variant_snapshot: null,
      combo_components_snapshot: [{ product_id: 9, product_name: 'A', quantity: 2 }],
      quantity: 1,
      unit_price: 500,
      discount_percentage: 0,
      line_subtotal: 500,
      sort_order: 0,
    })
    expect(item.combo_components_snapshot[0]?.product_id).toBe(9)
  })
})
