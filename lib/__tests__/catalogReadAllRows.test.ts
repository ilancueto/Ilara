import { describe, expect, it, vi } from 'vitest'
import { readAllCatalogRows } from '@/lib/domain/catalog/readAllRows'

describe('complete public catalog reads', () => {
  it('reads beyond 1000 rows and respects a provider cap lower than the requested range', async () => {
    const source = Array.from({ length: 1051 }, (_, id) => ({ id }))
    const page = vi.fn(async (from: number, to: number) => ({
      data: source.slice(from, Math.min(to + 1, from + 80)), error: null, count: source.length,
    }))
    const result = await readAllCatalogRows(page)
    expect(result).toEqual({ data: source, error: null })
    expect(page).toHaveBeenLastCalledWith(1040, 1239)
  })
  it('does not publish a partial catalog if a later page fails', async () => {
    const page = vi.fn()
      .mockResolvedValueOnce({ data: [{ id: 1 }], count: 2, error: null })
      .mockResolvedValueOnce({ data: null, count: null, error: { code: 'unavailable' } })
    expect(await readAllCatalogRows(page)).toEqual({ data: null, error: { code: 'unavailable' } })
  })
  it('stops on inconsistent counts instead of looping or declaring a truncated response complete', async () => {
    expect((await readAllCatalogRows(async () => ({ data: [], count: 3, error: null }))).error).toBeInstanceOf(Error)
    expect((await readAllCatalogRows(async () => ({ data: [], count: null, error: null }))).error).toBeInstanceOf(Error)
    expect(await readAllCatalogRows(async () => ({ data: [], count: 0, error: null }))).toEqual({ data: [], error: null })
  })
})
