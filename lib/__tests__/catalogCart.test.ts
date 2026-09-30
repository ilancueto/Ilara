import { describe, expect, it } from 'vitest'
import { cartQuote, parseCartReferences, resolveCart } from '../domain/catalog/cart'
import { normalizeCatalogSearch, sortCatalogItems } from '../domain/catalog/sorting'
import type { PublicCatalogProduct, PublicCatalogCombo } from '../domain/catalog/publicDto'
import { buildProductJsonLd } from '../productStructuredData'

const product: PublicCatalogProduct = { id: 1, name: 'Bálsamo', brand: null, color: null, sale_price: 2000, stock: 5, category_id: null, image_url: null, created_at: '2026-09-05' }
const combo: PublicCatalogCombo = { id: 2, name: 'Kit', description: null, sale_price: 10000, public_price: 9000, is_active: true, image_url: null, created_at: '2026-01-01', combo_items: [{ id: 1, product_id: 1, quantity: 2, products: product }] }

describe('bolsa con precios y stock actuales', () => {
  it('no acepta JSON arbitrario ni cantidades negativas/fraccionarias y migra el carrito anterior', () => {
    expect(parseCartReferences({ length: 3 })).toEqual([])
    expect(parseCartReferences([null, {}, { kind: 'product', id: 1, quantity: -1 }, { kind: 'combo', id: 2, quantity: 1.5 }])).toEqual([])
    expect(parseCartReferences([{ producto: { ...product, sale_price: 1 }, cantidad: 2 }])).toEqual([{ kind: 'product', id: 1, quantity: 2 }])
  })
  it('comparte stock entre un producto y dos combos con el mismo componente', () => {
    const next = resolveCart([{ kind: 'product', id: 1, quantity: 2 }, { kind: 'combo', id: 2, quantity: 3 }, { kind: 'combo', id: 3, quantity: 1 }], {
      productos: [product], combos: [combo, { ...combo, id: 3 }],
    })
    expect(next.map(i => i.cantidad)).toEqual([2, 1])
  })
  it('suma componentes repetidos y elimina productos/combo despublicados o agotados', () => {
    const refs = [{ kind: 'combo' as const, id: 2, quantity: 3 }]
    expect(resolveCart(refs, { productos: [product], combos: [{ ...combo, combo_items: [...combo.combo_items!, ...combo.combo_items!] }] })[0].cantidad).toBe(1)
    expect(resolveCart(refs, { productos: [], combos: [combo] })).toEqual([])
    expect(resolveCart(refs, { productos: [product], combos: [{ ...combo, is_active: false }] })).toEqual([])
    expect(resolveCart(refs, { productos: [{ ...product, visible_in_catalog: false }], combos: [combo] })).toEqual([])
  })
  it('recupera el precio nuevo del combo y detecta cambios antes de confirmar', () => {
    const next = resolveCart([{ kind: 'combo', id: 2, quantity: 1 }], { productos: [product], combos: [{ ...combo, public_price: 11000 }] })
    expect(next[0].combo?.public_price).toBe(11000)
    expect(cartQuote(next)).not.toBe(cartQuote([{ combo, cantidad: 1 }]))
  })
})

describe('catálogo consistente', () => {
  it('ordena globalmente productos y combos usando el precio mostrado', () => {
    expect(sortCatalogItems([combo, product], 'precio-asc', new Map()).map(p => p.id)).toEqual([1, 2])
    expect(sortCatalogItems([combo, product], 'nuevo-desc', new Map()).map(p => p.id)).toEqual([1, 2])
    expect(sortCatalogItems([combo, { ...product, sale_price: 9500 }], 'precio-asc', new Map()).map(p => p.id)).toEqual([2, 1])
  })
  it('encuentra nombres sin acentos y sin espacios externos', () => {
    expect(normalizeCatalogSearch(product.name)).toContain(normalizeCatalogSearch('  BALSAMO  '))
  })
  it('no declara envío gratis sin una tarifa fija real', () => {
    const ld = buildProductJsonLd(product, 'https://ilara.com.ar/catalogo/p/1', 'https://ilara.com.ar', 2000)
    expect(ld.offers).not.toHaveProperty('shippingDetails')
    expect(ld.offers).not.toHaveProperty('hasMerchantReturnPolicy')
    expect(ld.offers).toHaveProperty('price', 2000)
    expect(ld).not.toHaveProperty('brand')
  })
})
