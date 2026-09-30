import { afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), service: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/domain/orders/notificationOutbox', () => ({ dispatchOrderNotifications: mocks.dispatch }))
vi.mock('@/lib/supabase/service', () => ({ createSupabaseServiceClient: mocks.service }))
import { POST } from '@/app/api/internal/order-notifications/route'
import { GET } from '@/app/api/internal/operations-health/route'
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }))
vi.mock('@/lib/env', () => ({ getEnv: () => 'test-config' }))
import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'

describe('private operations endpoints', () => {
  afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs() })
  it.each(['/api/internal/operations-health', '/api/internal/order-notifications'])('lets %s reach its secret-authenticated handler without a browser session', async path => {
    vi.stubEnv('CRON_SECRET', 'test-only-cron-secret')
    const request = new NextRequest(`http://localhost${path}`)
    const forwarded = await proxy(request)
    expect(forwarded.headers.get('location')).toBeNull()
    expect(forwarded.headers.get('x-middleware-next')).toBe('1')
    expect((await (path.endsWith('order-notifications') ? POST(request) : GET(request))).status).toBe(401)
    expect(mocks.service).not.toHaveBeenCalled()
    expect(mocks.dispatch).not.toHaveBeenCalled()
  })
  it('keeps unknown internal paths behind session authentication', async () => {
    const response = await proxy(new NextRequest('http://localhost/api/internal/operations-health/other'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })
  it('allows the authorized worker through proxy and into the dispatcher', async () => {
    vi.stubEnv('CRON_SECRET', 'test-only-cron-secret')
    mocks.dispatch.mockResolvedValue({ claimed: 0, sent: 0 })
    const request = new NextRequest('http://localhost/api/internal/order-notifications', { method: 'POST', headers: { Authorization: 'Bearer test-only-cron-secret' } })
    expect((await proxy(request)).headers.get('location')).toBeNull()
    expect((await POST(request)).status).toBe(200)
    expect(mocks.dispatch).toHaveBeenCalledOnce()
  })
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
