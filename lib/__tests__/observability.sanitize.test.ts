import { describe, it, expect } from 'vitest'
import {
  sanitizeForTelemetry,
  isSensitiveKey,
  sanitizeHeaders,
} from '@/lib/observability/sanitize'
import { mapErrorCodeToEvent, ObservabilityEvent } from '@/lib/observability/events'
import { isSentryEnabled } from '@/lib/observability/report'

describe('observability sanitize', () => {
  it('redacts sensitive keys', () => {
    expect(isSensitiveKey('password')).toBe(true)
    expect(isSensitiveKey('email')).toBe(true)
    expect(isSensitiveKey('receipt_url')).toBe(true)
    expect(isSensitiveKey('customer_name')).toBe(true)
    expect(isSensitiveKey('durationMs')).toBe(false)
  })

  it('redacts nested PII and JWT-like values', () => {
    const out = sanitizeForTelemetry({
      email: 'a@b.com',
      password: 'secret',
      code: 'STOCK_INSUFFICIENT',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb',
      customer_name: 'Jane Doe',
      ok: true,
    }) as Record<string, unknown>
    expect(out.email).toBe('[REDACTED]')
    expect(out.password).toBe('[REDACTED]')
    expect(out.token).toBe('[REDACTED]')
    expect(out.customer_name).toBe('[REDACTED]')
    expect(out.code).toBe('STOCK_INSUFFICIENT')
    expect(out.ok).toBe(true)
  })

  it('redacts emails embedded in free-text messages', () => {
    const out = sanitizeForTelemetry('Login failed for user@example.com')
    expect(out).toBe('[REDACTED]')
  })

  it('sanitizes Error without leaking stack secrets in production shape', () => {
    const err = new Error('token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb')
    const out = sanitizeForTelemetry(err) as Record<string, unknown>
    expect(out.name).toBe('Error')
    expect(out.message).toBe('[REDACTED]')
  })

  it('does not leak cookie headers', () => {
    const h = sanitizeHeaders({
      cookie: 'sb-access-token=abc',
      'content-type': 'application/json',
      'x-request-id': 'rid-1',
    })
    expect(h.cookie).toBeUndefined()
    expect(h['content-type']).toBe('application/json')
    expect(h['x-request-id']).toBe('rid-1')
    expect(h['sensitive-headers']).toBe('[present-redacted]')
  })

  it('redacts Authorization keys and query token strings', () => {
    const out = sanitizeForTelemetry({
      Authorization: 'Bearer abc.def.ghi',
      Cookie: 'sb-access-token=xyz',
      href: 'https://x/?access_token=secretvalue',
    }) as Record<string, unknown>
    expect(out.Authorization).toBe('[REDACTED]')
    expect(out.Cookie).toBe('[REDACTED]')
    expect(out.href).toBe('[REDACTED]')
  })

  it('redacts nested sale-like payloads by key name', () => {
    const out = sanitizeForTelemetry({
      payment_breakdown: [{ method: 'efectivo', amount: 100 }],
      total: 100,
    }) as Record<string, unknown>
    expect(out.payment_breakdown).toBe('[REDACTED]')
    expect(out.total).toBe(100)
  })

  it('maps stock codes to business events', () => {
    expect(mapErrorCodeToEvent('STOCK_INSUFFICIENT')).toBe(
      ObservabilityEvent.STOCK_CONFLICT
    )
  })

  it('Sentry is disabled without DSN and in test', () => {
    expect(isSentryEnabled()).toBe(false)
  })
})
