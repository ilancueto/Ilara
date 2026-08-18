import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sql = readFileSync(
  join(__dirname, '../../supabase/migrations/20260818030000_stage94_payment_safety_guards.sql'),
  'utf8'
)

describe('Stage 9.4 seguridad de cobros', () => {
  it('impide registrar un reintegro de Mercado Pago desde una devolución', () => {
    expect(sql).toContain('ALTER FUNCTION public.create_order_return(jsonb)')
    expect(sql).toContain('SET SCHEMA private')
    expect(sql).toContain("payment_refund_must_be_requested_separately")
    expect(sql).toContain('RETURN private.create_order_return(p_payload)')
    expect(sql).not.toContain('PERFORM public.admin_refund_catalog_payment')
  })

  it('solo publica medios de cobro con una configuración completa', () => {
    expect(sql).toContain('payment_method_requires_payments')
    expect(sql).toContain('payment_methods_required')
    expect(sql).toContain('bank_details_required')
  })
})
