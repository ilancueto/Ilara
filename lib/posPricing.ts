/**
 * Precios en **punto de venta** vs **catálogo web**.
 * Política Etapa 1 (DATA-01) — **Opción A**:
 * - Catálogo web: aplica `discount_percentage`.
 * - POS: usa precio de lista (`sale_price`) **sin** descuento de catálogo.
 * - La DB (`create_sale_with_items`) es la autoridad: ignora unit_price/total del cliente
 *   y persiste unit_price/subtotal históricos en `sale_items`.
 * - Redondeo: `Math.round` / PostgreSQL `round(x, 0)` (enteros ARS).
 */
import { priceWithProductDiscount } from '@/lib/catalogPricing'
import type { ItemCarrito } from '@/lib/domain/types'

export const POS_PRICING_POLICY = 'pos_list_price_no_catalog_discount' as const

/** Precio unitario mostrado en el catálogo público (incluye % de descuento del producto). */
export function precioCatalogoProducto(producto: {
  sale_price: number
  discount_percentage?: number | null
}): number {
  return priceWithProductDiscount(producto.sale_price, producto.discount_percentage)
}

/**
 * Precio unitario en POS (preview UI). Debe coincidir con el RPC:
 * `round(sale_price::numeric, 0)` sin descuento de catálogo.
 */
export function precioListaProducto(producto: { sale_price: number }): number {
  const n = Math.round(Number(producto.sale_price) || 0)
  return n > 0 ? n : 0
}

export function precioListaCombo(salePrice: number): number {
  const n = Math.round(Number(salePrice) || 0)
  return n > 0 ? n : 0
}

/** Subtotal de línea producto (misma fórmula que el RPC). */
export function subtotalListaProducto(
  producto: { sale_price: number },
  quantity: number
): number {
  return precioListaProducto(producto) * Math.max(0, Math.floor(Number(quantity) || 0))
}

/** Subtotal de línea combo (misma fórmula que el RPC). */
export function subtotalListaCombo(salePrice: number, quantity: number): number {
  return precioListaCombo(salePrice) * Math.max(0, Math.floor(Number(quantity) || 0))
}

/** Total de carrito POS (preview). Autoridad final = RPC. */
export function totalCarritoPos(carrito: ItemCarrito[]): number {
  return carrito.reduce((sum, item) => {
    if (item.producto) {
      return sum + subtotalListaProducto(item.producto, item.cantidad)
    }
    if (item.combo) {
      return sum + subtotalListaCombo(item.combo.sale_price, item.cantidad)
    }
    return sum
  }, 0)
}
