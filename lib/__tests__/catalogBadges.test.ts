import { describe, it, expect } from 'vitest'
import { getCatalogBadgesForProduct } from '@/lib/catalogBadges'
import type { Producto } from '@/lib/supabase'

const base: Producto = {
    id: 1,
    name: 'Test',
    category_id: null,
    brand: null,
    color: null,
    purchase_price: null,
    sale_price: 100,
    stock: 5,
    min_stock: 1,
    image_url: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
}

describe('getCatalogBadgesForProduct', () => {
    it('agotado solo muestra Agotado', () => {
        const badges = getCatalogBadgesForProduct({ ...base, stock: 0 })
        expect(badges.map(b => b.texto)).toEqual(['Agotado'])
    })

    it('manual nuevos tiene prioridad sobre fecha', () => {
        const badges = getCatalogBadgesForProduct({
            ...base,
            catalog_badge: 'nuevos',
            created_at: '2000-01-01T00:00:00.000Z',
        })
        expect(badges.some(b => b.texto === 'NUEVOS')).toBe(true)
    })
})
