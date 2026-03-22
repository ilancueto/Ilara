import { describe, it, expect } from 'vitest'
import { precioCatalogoProducto, precioListaProducto } from '@/lib/posPricing'
import type { Producto } from '@/lib/supabase'

const p: Producto = {
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
}

describe('posPricing', () => {
    it('precioCatalogoProducto aplica descuento', () => {
        expect(precioCatalogoProducto(p)).toBe(900)
    })

    it('precioListaProducto es lista sin % web', () => {
        expect(precioListaProducto(p)).toBe(1000)
    })
})
