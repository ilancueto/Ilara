import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { deriveOrderAccessSecret, deriveOrderFollowSecret, hashOrderAccessSecret } from '@/lib/domain/payments/orderAccess'
import { buildOrderFollowPath, isOrderNumber } from '@/lib/domain/orders/followLink'
import { buildOrderWhatsAppMessage } from '@/lib/domain/orders/whatsappMessage'

const migration = readFileSync(
  join(__dirname, '../../supabase/migrations/20260818035000_stage97_order_follow.sql'),
  'utf8'
)
const checkout = readFileSync(
  join(__dirname, '../../components/Catalogo/CheckoutPedido.tsx'),
  'utf8'
)

describe('Stage 9.7 — link de seguimiento', () => {
  it('guarda solo el hash y no reescribe pedidos', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.order_follow_tokens')
    expect(migration).toContain('token_hash text NOT NULL')
    expect(migration).toContain('get_catalog_order_follow')
    expect(migration).toContain('private.resolve_order_follow')
    expect(migration).not.toMatch(/UPDATE\s+public\.orders\s+SET\s+sale_price/i)
    expect(migration).not.toMatch(/UPDATE\s+public\.order_follow_tokens\s+SET\s+token_hash/i)
    expect(migration).toContain("SET search_path = ''")
    expect(migration).toContain('REVOKE ALL ON TABLE public.order_follow_tokens FROM PUBLIC, anon, authenticated')
  })

  it('el token de seguimiento no es la clave de pago', async () => {
    const secret = 'order-access-secret-for-tests'
    const access = await deriveOrderAccessSecret('idem-1234567890abcd', secret)
    const follow = await deriveOrderFollowSecret('idem-1234567890abcd', secret)
    const followReplay = await deriveOrderFollowSecret('idem-1234567890abcd', secret)
    expect(follow).toBe(followReplay)
    expect(follow).not.toBe(access)
    expect(follow).toHaveLength(64)
    expect(await hashOrderAccessSecret(follow)).toHaveLength(64)
  })

  it('el link lleva el número de pedido y el token, no el order_id', () => {
    expect(isOrderNumber('IL-000123')).toBe(true)
    expect(isOrderNumber('abc')).toBe(false)
    const path = buildOrderFollowPath('IL-000123', 'abc123token')
    expect(path).toContain('/pedido/IL-000123')
    expect(path).toContain('t=abc123token')
    expect(path).not.toContain('order_id')
    expect(checkout).toContain('buildOrderFollowUrl')
    expect(checkout).toContain('checkout-copy-follow')
  })

  it('WhatsApp incluye el enlace y no la clave de pago', () => {
    const msg = buildOrderWhatsAppMessage({
      order_number: 'IL-000123',
      total: 90000,
      lines: [{ name: 'Labial', quantity: 1 }],
      follow_url: 'https://ilara.com.ar/pedido/IL-000123?t=followtoken',
    })
    expect(msg).toContain('https://ilara.com.ar/pedido/IL-000123?t=followtoken')
    expect(msg).not.toContain('access_capability')
  })
})
