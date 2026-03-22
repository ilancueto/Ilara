/**
 * Precios en **punto de venta** vs **catálogo web**.
 * Un solo lugar para evitar que cada pantalla invente su fórmula.
 */
import { priceWithProductDiscount } from '@/lib/catalogPricing'
import type { Producto } from '@/lib/supabase'

/** Precio unitario mostrado en el catálogo público (incluye % de descuento del producto). */
export function precioCatalogoProducto(producto: Producto): number {
    return priceWithProductDiscount(producto.sale_price, producto.discount_percentage)
}

/**
 * Precio base en POS: **lista de venta** sin el descuento “de catálogo web”.
 * La venta registrada puede usar otro valor si el vendedor negocia (flujo en `PuntoVenta`).
 */
export function precioListaProducto(producto: Producto): number {
    return producto.sale_price
}
