import { describe, it, expect } from 'vitest'
import {
  getCategoryIcon,
  getCategoryLabel,
  getCategoryColor,
  getPaymentMethodLabel,
  formatCurrency,
  formatDate,
  calculatePercentageChange,
  getMonthName,
} from '../expenseUtils'

describe('expenseUtils', () => {
  describe('getCategoryIcon', () => {
    it('returns emoji for known categories', () => {
      expect(getCategoryIcon('inventario')).toBe('💰')
      expect(getCategoryIcon('marketing')).toBe('📱')
      expect(getCategoryIcon('otros')).toBe('🔧')
    })
  })

  describe('getCategoryLabel', () => {
    it('returns label for category', () => {
      expect(getCategoryLabel('inventario')).toBeDefined()
      expect(getCategoryLabel('alquiler')).toBeDefined()
    })
  })

  describe('getCategoryColor', () => {
    it('returns Tailwind classes string', () => {
      const color = getCategoryColor('inventario')
      expect(color).toContain('bg-')
      expect(color).toContain('text-')
    })
  })

  describe('formatCurrency', () => {
    it('formats number as ARS currency', () => {
      expect(formatCurrency(1000)).toMatch(/\d/)
      expect(formatCurrency(0)).toBeDefined()
    })
  })

  describe('calculatePercentageChange', () => {
    it('returns 100 when previous is 0 and current > 0', () => {
      expect(calculatePercentageChange(10, 0)).toBe(100)
    })
    it('returns 0 when previous is 0 and current is 0', () => {
      expect(calculatePercentageChange(0, 0)).toBe(0)
    })
    it('calculates positive change', () => {
      expect(calculatePercentageChange(150, 100)).toBe(50)
    })
    it('calculates negative change', () => {
      expect(calculatePercentageChange(50, 100)).toBe(-50)
    })
  })

  describe('getMonthName', () => {
    it('returns short month and year', () => {
      const name = getMonthName(new Date(2024, 0, 15))
      expect(name).toBeDefined()
      expect(name.length).toBeGreaterThan(0)
    })
  })

  describe('getPaymentMethodLabel', () => {
    it('returns label for payment method', () => {
      expect(getPaymentMethodLabel('efectivo')).toBeDefined()
      expect(getPaymentMethodLabel('transferencia')).toBeDefined()
    })
  })

  describe('formatDate', () => {
    it('formats ISO date string to es-AR', () => {
      const formatted = formatDate('2024-03-15')
      expect(formatted).toBeDefined()
      expect(formatted).toMatch(/\d/)
    })
  })

  describe('calculatePercentageChange edge cases', () => {
    it('handles negative current with positive previous', () => {
      expect(calculatePercentageChange(-50, 100)).toBe(-150)
    })
    it('handles same value', () => {
      expect(calculatePercentageChange(100, 100)).toBe(0)
    })
  })
})
