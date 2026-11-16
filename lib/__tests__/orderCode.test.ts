import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isOrderNumber, normalizeOrderNumber } from '@/lib/domain/orders/followLink'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261116010000_order_public_code_and_lookup.sql'),
  'utf8'
)

describe('código público de pedido', () => {
  it('acepta el formato nuevo y el viejo', () => {
    expect(isOrderNumber('ILARA-7K3QPX')).toBe(true)
    expect(isOrderNumber('IL-000123')).toBe(true)
  })

  it('rechaza caracteres ambiguos, largo incorrecto y basura', () => {
    expect(isOrderNumber('ILARA-7K3QP0')).toBe(false)
    expect(isOrderNumber('ILARA-7K3QPI')).toBe(false)
    expect(isOrderNumber('ILARA-7K3QP')).toBe(false)
    expect(isOrderNumber('ILARA-7K3QPXX')).toBe(false)
    expect(isOrderNumber('ilara-7k3qpx')).toBe(false)
    expect(isOrderNumber('abc')).toBe(false)
  })

  it('normaliza lo que escribe la clienta', () => {
    expect(normalizeOrderNumber('ilara 7k3qpx')).toBe('ILARA-7K3QPX')
    expect(normalizeOrderNumber('ILARA7K3QPX')).toBe('ILARA-7K3QPX')
    expect(normalizeOrderNumber(' 7k3qpx ')).toBe('ILARA-7K3QPX')
    expect(normalizeOrderNumber('#ILARA-7K3QPX')).toBe('ILARA-7K3QPX')
    expect(normalizeOrderNumber('il-000123')).toBe('IL-000123')
    expect(normalizeOrderNumber('il000123')).toBe('IL-000123')
  })

  it('la base valida el mismo formato que la app', () => {
    expect(migration).toContain("'^(IL-[0-9]{6,}|ILARA-[2-9A-HJKMNP-Z]{6})$'")
    expect(migration).toContain("'23456789ABCDEFGHJKMNPQRSTUVWXYZ'")
  })

  it('la búsqueda es solo para el servidor y limita intentos', () => {
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.verify_order_lookup\(text, text, text\) FROM PUBLIC, anon, authenticated/)
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.verify_order_lookup\(text, text, text\) TO service_role/)
    expect(migration).toContain('ALTER TABLE public.order_lookup_attempts ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain("interval '15 minutes') >= 10")
  })
})
