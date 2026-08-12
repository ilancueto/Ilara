import { describe, it, expect } from 'vitest'
import {
  precioCatalogoProducto,
  precioListaProducto,
  precioListaCombo,
  subtotalListaProducto,
  subtotalListaCombo,
  totalCarritoPos,
  POS_PRICING_POLICY,
} from '@/lib/posPricing'
import type { ItemCarrito, Producto } from '@/lib/supabase'

const p = (overrides: Partial<Producto> = {}): Producto =>
  ({
    id: 1,
    name: 'X',
    category_id: null,
    brand: null,
    color: null,
    purchase_price: null,
    sale_price: 1000,
    stock: 2,
    min_stock: 1,
    image_url: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    discount_percentage: 10,
    ...overrides,
  }) as Producto

describe('posPricing (Opción A — alineado a RPC)', () => {
  it('precioCatalogoProducto aplica descuento web', () => {
    expect(precioCatalogoProducto(p())).toBe(900)
  })

  it('precioListaProducto es lista sin % web', () => {
    expect(precioListaProducto(p())).toBe(1000)
    expect(precioListaProducto(p({ discount_percentage: 50 }))).toBe(1000)
  })

  it('redondeo de decimales coincide con round half (positivos)', () => {
    expect(precioListaProducto(p({ sale_price: 1500.4 }))).toBe(1500)
    expect(precioListaProducto(p({ sale_price: 1500.5 }))).toBe(1501)
    expect(precioListaProducto(p({ sale_price: 1500.6 }))).toBe(1501)
    expect(precioListaCombo(1500.6)).toBe(1501)
    expect(precioListaCombo(99.4)).toBe(99)
  })

  it('subtotales y total de carrito usan precio de lista redondeado', () => {
    const prod = p({ sale_price: 999.6, discount_percentage: 20 })
    expect(subtotalListaProducto(prod, 2)).toBe(1000 * 2)
    expect(subtotalListaCombo(1500.6, 3)).toBe(1501 * 3)

    const carrito: ItemCarrito[] = [
      { producto: prod, cantidad: 2 },
      {
        combo: {
          id: 9,
          name: 'Combo',
          sale_price: 1500.6,
          is_active: true,
          description: null,
          image_url: null,
          created_at: '',
          updated_at: '',
        } as NonNullable<ItemCarrito['combo']>,
        cantidad: 1,
      },
    ]
    // 1000*2 + 1501 = 3501 (no 999.6*2 ni descuento web)
    expect(totalCarritoPos(carrito)).toBe(3501)
  })

  it('política alineada al RPC', () => {
    expect(POS_PRICING_POLICY).toBe('pos_list_price_no_catalog_discount')
  })

  it('precios no positivos en lista se tratan como 0 en preview (RPC rechaza en DB)', () => {
    expect(precioListaProducto(p({ sale_price: 0 }))).toBe(0)
    expect(precioListaProducto(p({ sale_price: -5 }))).toBe(0)
  })
})
