import { describe, it, expect } from 'vitest'
import { CATALOG_CONFIG } from '../config'

describe('config', () => {
  describe('CATALOG_CONFIG', () => {
    it('has required keys', () => {
      expect(CATALOG_CONFIG).toHaveProperty('productsPerPage')
      expect(CATALOG_CONFIG).toHaveProperty('showOutOfStock')
      expect(CATALOG_CONFIG).toHaveProperty('enableSearch')
      expect(CATALOG_CONFIG).toHaveProperty('enableFilters')
    })
    it('productsPerPage is positive number', () => {
      expect(typeof CATALOG_CONFIG.productsPerPage).toBe('number')
      expect(CATALOG_CONFIG.productsPerPage).toBeGreaterThan(0)
    })
    it('flags are boolean', () => {
      expect(typeof CATALOG_CONFIG.showOutOfStock).toBe('boolean')
      expect(typeof CATALOG_CONFIG.enableSearch).toBe('boolean')
      expect(typeof CATALOG_CONFIG.enableFilters).toBe('boolean')
    })
  })
})
