import { afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), service: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/domain/orders/notificationOutbox', () => ({ dispatchOrderNotifications: mocks.dispatch }))
vi.mock('@/lib/supabase/service', () => ({ createSupabaseServiceClient: mocks.service }))
import { POST } from '@/app/api/internal/order-notifications/route'
import { GET } from '@/app/api/internal/operations-health/route'

describe('private operations endpoints', () => {
  afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs() })
  it('rejects public access without touching queues or reading operational data', async () => {
    vi.stubEnv('CRON_SECRET', 'test-only-cron-secret')
    const request = new Request('http://localhost/api/internal/operations-health')
    expect((await GET(request)).status).toBe(401)
    expect((await POST(request)).status).toBe(401)
    expect(mocks.service).not.toHaveBeenCalled()
    expect(mocks.dispatch).not.toHaveBeenCalled()
  })
  it('reports only counters and sanitizes worker errors', async () => {
    vi.stubEnv('CRON_SECRET', 'test-only-cron-secret')
    mocks.dispatch.mockRejectedValue(new Error('private-provider-token'))
    const response = await POST(new Request('http://localhost/api/internal/order-notifications', { headers: { Authorization: 'Bearer test-only-cron-secret' } }))
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('private-provider-token')
  })
})
