import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), server: vi.fn(), notify: vi.fn(), create: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/dal/auth', () => ({ requireAdmin: mocks.auth }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: mocks.server }))
vi.mock('@/lib/domain/orders/sendOrderEmail', () => ({ notifyOrderCustomer: mocks.notify }))
vi.mock('@/lib/dal/orders', () => ({ createCatalogOrderServer: mocks.create }))
vi.mock('@/lib/domain/orders/followSession', () => ({ setOrderFollowCookie: vi.fn() }))
import { notifyOrderStatusAction, createCatalogOrderAction } from '@/app/actions/orders'

function client(status: string, hasEvent = true) {
  return { from: (table: string) => {
    const chain = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn() }
    for (const method of ['select', 'eq', 'order', 'limit'] as const) chain[method].mockReturnValue(chain)
    chain.maybeSingle.mockResolvedValue({ data: table === 'orders' ? { id: 'order-1', status } : hasEvent ? { id: 7 } : null, error: null })
    return chain
  } }
}

describe('autorización de avisos de pedidos', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ id: 'admin' }); mocks.notify.mockResolvedValue(true) })
  it.each(['not_authenticated', 'not_authorized'])('deniega %s antes de consultar o enviar', async reason => {
    mocks.auth.mockRejectedValueOnce(new Error(reason))
    expect(await notifyOrderStatusAction('IL-000001', 'cancelled')).toEqual({ ok: false })
    expect(mocks.server).not.toHaveBeenCalled()
    expect(mocks.notify).not.toHaveBeenCalled()
  })
  it('rechaza un estado inventado aunque lo solicite un admin', async () => {
    mocks.server.mockResolvedValue(client('pending'))
    expect(await notifyOrderStatusAction('IL-000001', 'completed')).toEqual({ ok: false })
    expect(mocks.notify).not.toHaveBeenCalled()
  })
  it('requiere un evento persistido y acepta un cambio real', async () => {
    mocks.server.mockResolvedValue(client('ready', false))
    expect(await notifyOrderStatusAction('IL-000001', 'ready')).toEqual({ ok: false })
    mocks.server.mockResolvedValue(client('ready'))
    expect(await notifyOrderStatusAction('IL-000001', 'ready')).toEqual({ ok: true })
    expect(mocks.notify).toHaveBeenCalledExactlyOnceWith('IL-000001', 'ready')
  })
  it('ignora artículos aportados por el navegador al crear el correo', async () => {
    mocks.create.mockResolvedValue({ order_number: 'IL-000001', status: 'pending' })
    const result = await createCatalogOrderAction({ idempotency_key: 'example', customer_name: 'Cliente', customer_phone: '1234567890', lines: [] }, { lines: [{ name: 'Texto inventado', quantity: 99 }] })
    expect(result.ok).toBe(true)
    expect(mocks.notify).toHaveBeenCalledExactlyOnceWith('IL-000001', 'created')
  })
})
