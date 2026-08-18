import { describe, expect, it } from 'vitest'
import { panelHref, toPanelQuery } from '@/lib/appNavigation'

describe('panelHref', () => {
  it('builds a tab-only link', () => {
    expect(panelHref({ tab: 'dashboard' })).toBe('/?tab=dashboard')
  })

  it('keeps extra params for deep links', () => {
    expect(
      panelHref({
        tab: 'inventory',
        productId: 12,
        focus: 'stock',
      })
    ).toBe('/?tab=inventory&productId=12&focus=stock')
    expect(
      panelHref({
        tab: 'returns',
        channel: 'pos',
        saleId: 44,
      })
    ).toBe('/?tab=returns&channel=pos&saleId=44')
    expect(panelHref({ tab: 'customers', customerId: 9 })).toBe('/?tab=customers&customerId=9')
  })

  it('accepts a tab string as navigate dest', () => {
    expect(toPanelQuery('orders')).toEqual({ tab: 'orders' })
  })
})
