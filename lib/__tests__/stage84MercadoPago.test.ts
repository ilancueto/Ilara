import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  hmacSha256Hex,
  mpWebhookManifest,
  parseMpSignatureHeader,
  verifyMpWebhookSignature,
} from '../domain/payments/mpSignature'
import { extractMpFeeAndNet, mapMercadoPagoStatus } from '../domain/payments/mpStatus'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260818003000_stage84_mercado_pago.sql'),
  'utf8'
)
const webhook = readFileSync(
  resolve(process.cwd(), 'supabase/functions/payments-mp-webhook/index.ts'),
  'utf8'
)
const preference = readFileSync(
  resolve(process.cwd(), 'supabase/functions/payments-mp-preference/index.ts'),
  'utf8'
)

describe('Stage 8.4 — firma de notificaciones', () => {
  it('acepta el manifest oficial y rechaza firmas viejas o truncadas', async () => {
    const secret = 'mp-webhook-secret-for-tests'
    const dataId = '123456789'
    const requestId = 'req-abc'
    const ts = '1704908010'
    const v1 = await hmacSha256Hex(secret, mpWebhookManifest({ dataId, requestId, ts }))
    const header = `ts=${ts},v1=${v1}`
    expect(parseMpSignatureHeader(header)).toEqual({ ts, v1 })
    expect(
      await verifyMpWebhookSignature({
        signatureHeader: header,
        requestId,
        dataId,
        secret,
        nowMs: Number(ts) * 1000,
      })
    ).toBe(true)
    expect(
      await verifyMpWebhookSignature({
        signatureHeader: header,
        requestId,
        dataId,
        secret,
        nowMs: Number(ts) * 1000 + 301_000,
      })
    ).toBe(false)
    expect(
      await verifyMpWebhookSignature({
        signatureHeader: `ts=${ts},v1=${'a'.repeat(64)}`,
        requestId,
        dataId,
        secret,
        nowMs: Number(ts) * 1000,
      })
    ).toBe(false)
  })
})

describe('Stage 8.4 — estados y comisión real', () => {
  it('mapea estados y no mezcla recargo con comisión', () => {
    expect(mapMercadoPagoStatus('approved')).toBe('approved')
    expect(mapMercadoPagoStatus('in_process')).toBe('pending')
    expect(mapMercadoPagoStatus('charged_back')).toBe('ignore')
    expect(mapMercadoPagoStatus('unknown')).toBe('ignore')
    expect(
      extractMpFeeAndNet({
        fee_details: [{ amount: 100 }, { amount: 21 }],
        transaction_details: { net_received_amount: 105579 },
      })
    ).toEqual({ actualFee: 121, netReceived: 105579 })
  })
})

describe('Stage 8.4 — migración y edge functions', () => {
  it('aplica GET canónico, no confirma por retorno y no toca sales', () => {
    expect(migration).toContain('apply_mercado_pago_payment')
    expect(migration).toContain('attach_mp_preference')
    expect(migration).toContain('admin_refund_catalog_payment')
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.apply_mercado_pago_payment(jsonb) TO service_role')
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.apply_mercado_pago_payment(jsonb) FROM PUBLIC, anon, authenticated')
    expect(migration).toContain('confirm_catalog_order_after_payment')
    expect(preference).toContain('X-Idempotency-Key')
    expect(preference).toContain('auto_return')
    expect(preference).toContain('/pedido')
    expect(webhook).toContain('x-signature')
    expect(webhook).toContain('/v1/payments/')
    expect(webhook).not.toMatch(/NEXT_PUBLIC_/)
    expect(preference).not.toMatch(/NEXT_PUBLIC_/)
  })
})
