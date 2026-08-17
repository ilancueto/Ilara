import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  canTransitionPayment,
  paymentMethodLabel,
  paymentStatusLabel,
} from '../domain/payments/states'
import { transitionMayRestoreStock } from '../domain/orders/states'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260817225016_stage82_payment_core.sql'),
  'utf8'
)

describe('Stage 8.2 — estados de pago', () => {
  it('no mezcla la máquina operativa del pedido', () => {
    expect(canTransitionPayment('pending', 'approved')).toBe(true)
    expect(canTransitionPayment('approved', 'pending')).toBe(false)
    expect(canTransitionPayment('expired', 'approved')).toBe(false)
    expect(paymentStatusLabel('requires_review')).toBe('Comprobante en revisión')
    expect(paymentMethodLabel('bank_transfer')).toBe('Transferencia bancaria')
  })

  it('un pending reservado puede devolver stock al cancelar', () => {
    expect(transitionMayRestoreStock('pending', 'cancelled')).toBe(true)
  })
})

describe('Stage 8.2 — migración', () => {
  it('cierra tablas, reserva al iniciar y usa cron.schedule', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.order_payments')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.payment_events')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.payment_access_tokens')
    expect(migration).toContain('REVOKE ALL ON TABLE public.order_payments FROM PUBLIC, anon, authenticated')
    expect(migration).toContain('start_catalog_order_payment')
    expect(migration).toContain('private.reserve_order_stock')
    expect(migration).toContain('expire_catalog_payments')
    expect(migration).toContain("cron.schedule")
    expect(migration).not.toMatch(/^\s*UPDATE\s+cron\.job/im)
    expect(migration).toContain('client_price_not_allowed')
    expect(migration).toContain('payments_disabled')
  })
})
