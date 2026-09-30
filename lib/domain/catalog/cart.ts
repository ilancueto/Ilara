import type { PublicCatalogCombo, PublicCatalogProduct } from './publicDto'
import { catalogDisplayComboPrice, catalogDisplayUnitPrice } from '../payments/catalogDisplayPrice'

export type CatalogCartItem = { producto?: PublicCatalogProduct; combo?: PublicCatalogCombo; cantidad: number }
export type CartReference = { kind: 'product' | 'combo'; id: number; quantity: number }
export type CartCatalog = { productos: PublicCatalogProduct[]; combos: PublicCatalogCombo[] }

/** Identifiers and positive integer quantities only. Also accepts legacy stored carts. */
export function parseCartReferences(value: unknown): CartReference[] {
  if (!Array.isArray(value)) return []
  const refs = new Map<string, CartReference>()
  for (const raw of value.slice(0, 100)) {
    if (!raw || typeof raw !== 'object') continue
    const kind = raw.kind ?? (raw.producto && !raw.combo ? 'product' : raw.combo && !raw.producto ? 'combo' : null)
    const id = raw.id ?? raw.producto?.id ?? raw.combo?.id
    const quantity = raw.quantity ?? raw.cantidad
    if ((kind !== 'product' && kind !== 'combo') || !Number.isSafeInteger(id) || id <= 0 ||
      !Number.isSafeInteger(quantity) || quantity <= 0) continue
    const key = `${kind}:${id}`
    refs.set(key, { kind, id, quantity: Math.min(999, (refs.get(key)?.quantity ?? 0) + quantity) })
  }
  return [...refs.values()]
}

export function cartReferences(cart: CatalogCartItem[]): CartReference[] {
  return cart.map(item => ({ kind: item.producto ? 'product' : 'combo', id: (item.producto ?? item.combo)!.id, quantity: item.cantidad }))
}

/** Consume stock once across loose products and combo components, in cart order. */
export function resolveCart(refs: CartReference[], catalog: CartCatalog): CatalogCartItem[] {
  const products = new Map(catalog.productos.map(p => [p.id, p]))
  const combos = new Map(catalog.combos.map(c => [c.id, c]))
  const remaining = new Map(catalog.productos.map(p => [p.id, Math.max(0, Math.floor(p.stock))]))
  const result: CatalogCartItem[] = []
  for (const ref of refs) {
    const product = ref.kind === 'product' ? products.get(ref.id) : undefined
    const combo = ref.kind === 'combo' ? combos.get(ref.id) : undefined
    const demand = new Map<number, number>()
    if (product && product.visible_in_catalog !== false) demand.set(product.id, 1)
    else if (combo?.is_active && combo.combo_items?.length) {
      for (const item of combo.combo_items) demand.set(item.product_id, (demand.get(item.product_id) ?? 0) + item.quantity)
    } else continue
    let quantity = ref.quantity
    for (const [id, units] of demand) {
      const p = products.get(id)
      if (!p || p.visible_in_catalog === false || !Number.isSafeInteger(units) || units <= 0) { quantity = 0; break }
      quantity = Math.min(quantity, Math.floor((remaining.get(id) ?? 0) / units))
    }
    if (!Number.isSafeInteger(quantity) || quantity <= 0) continue
    for (const [id, units] of demand) remaining.set(id, (remaining.get(id) ?? 0) - units * quantity)
    result.push(product ? { producto: product, cantidad: quantity } : { combo, cantidad: quantity })
  }
  return result
}

export function cartQuote(cart: CatalogCartItem[]): string {
  return JSON.stringify(cart.map(item => ({ ...cartReferences([item])[0], price: item.producto
    ? catalogDisplayUnitPrice(item.producto) : catalogDisplayComboPrice(item.combo!) })))
}
