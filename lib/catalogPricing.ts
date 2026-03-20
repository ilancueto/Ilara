/**
 * Lógica pura de precios del catálogo (descuentos por producto y cupón sobre el total).
 * Centralizada para tests y para no duplicar en componentes.
 */

export function priceWithProductDiscount(
  salePrice: number,
  discountPercentage: number | null | undefined
): number {
  const d = discountPercentage ?? 0
  if (d <= 0) return salePrice
  return Math.round(salePrice * (1 - d / 100))
}

export function cartLineSubtotal(unitPrice: number, quantity: number): number {
  return unitPrice * quantity
}

export function cartSubtotal(
  lines: Array<{ unitPrice: number; quantity: number }>
): number {
  return lines.reduce((sum, line) => sum + cartLineSubtotal(line.unitPrice, line.quantity), 0)
}

/** Descuento en pesos cuando el cupón es un % sobre el subtotal (mismo redondeo que el catálogo). */
export function couponDiscountFromPercent(
  subtotal: number,
  couponPercent: number
): number {
  if (couponPercent <= 0 || subtotal <= 0) return 0
  return Math.round(subtotal * (couponPercent / 100))
}

export function totalAfterCoupon(subtotal: number, couponDiscountPesos: number): number {
  return subtotal - couponDiscountPesos
}
