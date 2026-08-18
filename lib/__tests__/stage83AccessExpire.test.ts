import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deriveOrderAccessSecret, hashOrderAccessSecret } from '../domain/payments/orderAccess'
import { authorizeInternalJob } from '../security/cronAuth'
import { INTERNAL_WORDS_FORBIDDEN_IN_PUBLIC_UI } from '../domain/payments/labels'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260817231453_stage83_access_expire_transfer.sql'),
  'utf8'
)
const vercel = readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')
const expireWorkflow = readFileSync(
  resolve(process.cwd(), '.github/workflows/expire-catalog-payments.yml'),
  'utf8'
)
const pedido = readFileSync(resolve(process.cwd(), 'components/Catalogo/PedidoPagoClient.tsx'), 'utf8')

describe('Stage 8.3 — clave de seguimiento', () => {
  it('es determinista y solo guarda el hash', async () => {
    const secret = 'order-access-secret-for-tests'
    const first = await deriveOrderAccessSecret('idem-1234567890abcd', secret)
    const replay = await deriveOrderAccessSecret('idem-1234567890abcd', secret)
    const other = await deriveOrderAccessSecret('idem-other-buyer-key', secret)
    expect(first).toBe(replay)
    expect(first).toHaveLength(64)
    expect(other).not.toBe(first)
    const hashed = await hashOrderAccessSecret(first)
    expect(hashed).toHaveLength(64)
    expect(hashed).not.toBe(first)
  })
})

describe('Stage 8.3 — job interno', () => {
  it('exige el secreto y no lo refleja', () => {
    const previous = process.env.CRON_SECRET
    process.env.CRON_SECRET = 'cron-secret-for-unit-tests'
    expect(authorizeInternalJob(new Request('https://ilara.test/api/internal/expire-payments'))).toBe(false)
    expect(
      authorizeInternalJob(
        new Request('https://ilara.test/api/internal/expire-payments', {
          headers: { authorization: 'Bearer wrong-secret-for-unit-tests' },
        })
      )
    ).toBe(false)
    expect(
      authorizeInternalJob(
        new Request('https://ilara.test/api/internal/expire-payments', {
          headers: { authorization: 'Bearer cron-secret-for-unit-tests' },
        })
      )
    ).toBe(true)
    process.env.CRON_SECRET = previous
  })
})

describe('Stage 8.3 — migración y programación', () => {
  it('exige capability, no order_id, y programa GitHub Actions cada 5 minutos', () => {
    expect(migration).toContain('order_access_capabilities')
    expect(migration).toContain('access_capability_hash')
    expect(migration).toContain('client_order_id_not_allowed')
    expect(migration).toContain('price_uplift')
    expect(migration).toContain('Comisión efectiva estimada del proveedor (MP)')
    expect(migration).toContain('payment-receipts')
    expect(migration).toContain('admin_review_transfer_payment')
    expect(migration).toContain('payment_expire_runs')
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.expire_catalog_payments() TO service_role')
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.expire_catalog_payments() FROM PUBLIC, anon, authenticated')
    expect(migration).not.toMatch(/resolve_order_access[\s\S]{0,80}STABLE/)
    expect(migration).not.toMatch(/cron\.schedule/)
    expect(vercel).not.toContain('*/5 * * * *')
    expect(vercel).not.toMatch(/"crons"\s*:/)
    expect(expireWorkflow).toContain("cron: '*/5 * * * *'")
    expect(expireWorkflow).toContain('/api/internal/expire-payments')
    expect(expireWorkflow).toContain('ILARA_CRON_SECRET')
    expect(expireWorkflow).toMatch(/Authorization:\s*Bearer \$ILARA_CRON_SECRET/)
  })

  it('el copy público no filtra jerga interna', () => {
    const lower = pedido.toLowerCase()
    for (const word of INTERNAL_WORDS_FORBIDDEN_IN_PUBLIC_UI) {
      expect(lower).not.toContain(word)
    }
  })
})
