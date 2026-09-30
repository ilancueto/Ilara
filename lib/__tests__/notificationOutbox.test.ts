import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ client: vi.fn(), follow: vi.fn(), send: vi.fn(), prepare: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({ createSupabaseServiceClient: mocks.client }))
vi.mock('@/lib/domain/orders/sendOrderEmail', () => ({ createOrderNotificationUrl: mocks.follow, sendOrderCustomerEmail: mocks.send, prepareOrderCustomerEmail: mocks.prepare }))
import { dispatchOrderNotifications } from '@/lib/domain/orders/notificationOutbox'

describe('durable notification delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv('RESEND_API_KEY', 'test-only-key'); vi.stubEnv('ORDER_EMAIL_FROM', 'test@example.com')
    mocks.follow.mockResolvedValue('https://example.com/follow'); mocks.prepare.mockReturnValue('frozen-body')
  })
  afterEach(() => vi.unstubAllEnvs())
  it('does not consume attempts or freeze an invalid sender while configuration is missing', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    await expect(dispatchOrderNotifications()).rejects.toThrow('notification_email_not_configured')
    expect(mocks.client).not.toHaveBeenCalled()
  })
  it('persists before sending and reuses the exact envelope and key after a restart', async () => {
    const job = { id: 'job-1', order_id: 'order-1', kind: 'created', lease_token: 'lease-1', payload: null }
    const calls: string[] = []
    const rpc = vi.fn(async (name: string) => ({ error: null, data: name === 'claim_order_notifications' ? [job] : true }))
    const from = vi.fn((table: string) => {
      const chain: Record<string, unknown> = {}
      for (const method of ['select', 'eq']) chain[method] = () => chain
      chain.single = async () => ({ error: null, data: { customer_email: 'fixture@example.com', customer_name: 'Test', order_number: 'IL-1', total: 1000, fulfillment_mode: 'retiro' } })
      chain.order = async () => ({ error: null, data: [{ name_snapshot: 'Product', quantity: 1 }] })
      chain.update = (value: { payload: null }) => {
        job.payload = value.payload
        calls.push('persist')
        return { eq: () => ({ eq: () => ({ eq: () => ({ select: async () => ({ error: null, data: [{ id: job.id }] }) }) }) }) }
      }
      if (table === 'orders' || table === 'order_items' || table === 'order_notification_outbox') return chain
      throw new Error('unexpected table')
    })
    mocks.client.mockReturnValue({ rpc, from })
    mocks.send.mockImplementation(async () => { calls.push('send'); return false })
    expect(await dispatchOrderNotifications()).toEqual({ claimed: 1, sent: 0 })
    expect(calls).toEqual(['persist', 'send'])
    expect(rpc).toHaveBeenLastCalledWith('finish_order_notification', expect.objectContaining({ p_state: 'pending', p_lease: 'lease-1' }))
    job.lease_token = 'lease-2'
    mocks.send.mockResolvedValue(true)
    expect(await dispatchOrderNotifications()).toEqual({ claimed: 1, sent: 1 })
    expect(mocks.follow).toHaveBeenCalledTimes(1)
    expect(mocks.send.mock.calls[1]).toEqual(mocks.send.mock.calls[0])
    expect(mocks.send).toHaveBeenLastCalledWith(expect.any(Object), 'job-1', 'frozen-body')
    expect(rpc).toHaveBeenLastCalledWith('finish_order_notification', expect.objectContaining({ p_state: 'sent', p_lease: 'lease-2' }))
  })
})
