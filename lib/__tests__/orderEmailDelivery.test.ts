import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendOrderCustomerEmail } from '@/lib/domain/orders/sendOrderEmail'

vi.mock('server-only', () => ({}))
const input = { customerName: 'Prueba', customerEmail: 'test@example.com', orderNumber: 'IL-000001', total: 1000, lines: [], followUrl: null, kind: 'created' as const }

describe('email delivery without real provider calls', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubEnv('RESEND_API_KEY', 'test-key-only')
    vi.stubEnv('ORDER_EMAIL_FROM', 'Ilara <test@example.com>')
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })
  it('retries a temporary outage with the exact same payload and idempotency key', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValueOnce(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const sending = sendOrderCustomerEmail(input)
    await vi.runAllTimersAsync()
    expect(await sending).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const first = fetchMock.mock.calls[0][1]
    const second = fetchMock.mock.calls[1][1]
    expect(second.body).toBe(first.body)
    expect(second.headers).toEqual(first.headers)
  })
  it('does not retry invalid credentials or exceed the time budget for a rate limit', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('', { status: 401 })).mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '60' } }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await sendOrderCustomerEmail(input)).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(await sendOrderCustomerEmail(input)).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('limits network failures to three attempts', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network unavailable'))
    vi.stubGlobal('fetch', fetchMock)
    const sending = sendOrderCustomerEmail(input)
    await vi.runAllTimersAsync()
    expect(await sending).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
  it('does not contact the provider without configuration or a valid email', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('RESEND_API_KEY', '')
    expect(await sendOrderCustomerEmail(input)).toBe(false)
    expect(await sendOrderCustomerEmail({ ...input, customerEmail: 'invalid' })).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
