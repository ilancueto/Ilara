import { describe, it, expect } from 'vitest'
import {
  priceWithProductDiscount,
  cartSubtotal,
  couponDiscountFromPercent,
  totalAfterCoupon,
  cartLineSubtotal,
} from '../catalogPricing'

describe('catalogPricing', () => {
  describe('priceWithProductDiscount', () => {
    it('sin descuento devuelve precio de venta', () => {
      expect(priceWithProductDiscount(1000, 0)).toBe(1000)
      expect(priceWithProductDiscount(1000, null)).toBe(1000)
      expect(priceWithProductDiscount(1000, undefined)).toBe(1000)
    })
    it('aplica porcentaje y redondea', () => {
      expect(priceWithProductDiscount(1000, 10)).toBe(900)
      expect(priceWithProductDiscount(999, 33)).toBe(669)
    })
    it('100% deja 0', () => {
      expect(priceWithProductDiscount(5000, 100)).toBe(0)
    })
  })

  describe('cartSubtotal', () => {
    it('suma líneas', () => {
      expect(
        cartSubtotal([
          { unitPrice: 100, quantity: 2 },
          { unitPrice: 50, quantity: 1 },
        ])
      ).toBe(250)
    })
    it('vacío es 0', () => {
      expect(cartSubtotal([])).toBe(0)
    })
  })

  describe('cartLineSubtotal', () => {
    it('multiplica', () => {
      expect(cartLineSubtotal(1500, 3)).toBe(4500)
    })
  })

  describe('couponDiscountFromPercent', () => {
    it('0% o subtotal 0', () => {
      expect(couponDiscountFromPercent(1000, 0)).toBe(0)
      expect(couponDiscountFromPercent(0, 20)).toBe(0)
    })
    it('redondea como el catálogo', () => {
      expect(couponDiscountFromPercent(1000, 15)).toBe(150)
      expect(couponDiscountFromPercent(333, 10)).toBe(33)
    })
  })

  describe('totalAfterCoupon', () => {
    it('resta descuento en pesos', () => {
      expect(totalAfterCoupon(1000, 150)).toBe(850)
    })
  })
})
