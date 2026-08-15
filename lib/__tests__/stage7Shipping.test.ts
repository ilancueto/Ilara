import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildCreateOrderPayload, createOrderErrorFromRpc } from '../domain/orders/createOrder'
import { formatPesoARExact } from '../formatPesoAR'

const root = process.cwd()
const migration = readFileSync(
  resolve(root, 'supabase/migrations/20260814092526_stage7_envia_shipping.sql'),
  'utf8'
)
const stage71Migration = readFileSync(
  resolve(root, 'supabase/migrations/20260814205248_stage71_structured_shipping_address.sql'),
  'utf8'
)
const stage72Migration = readFileSync(
  resolve(root, 'supabase/migrations/20260815010716_stage72_customer_postal_code.sql'),
  'utf8'
)
const edgeFunction = readFileSync(
  resolve(root, 'supabase/functions/shipping-quotes/index.ts'),
  'utf8'
)
const checkout = readFileSync(
  resolve(root, 'components/Catalogo/CheckoutPedido.tsx'),
  'utf8'
)

describe('Stage 7 — cotizaciones Envia', () => {
  it('mantiene token y llamadas de proveedor exclusivamente en Edge Function', () => {
    expect(edgeFunction).toContain("Deno.env.get('ENVIA_TOKEN')")
    expect(edgeFunction).toContain('https://api.envia.com/ship/rate/')
    expect(edgeFunction).not.toMatch(/NEXT_PUBLIC_ENVIA/i)
  })

  it('usa el bulto acordado y sólo cotiza (no genera etiquetas)', () => {
    expect(edgeFunction).toMatch(/type: 'envelope'/)
    expect(edgeFunction).toMatch(/weight: 1/)
    expect(edgeFunction).toMatch(/dimensions: \{ length: 35, width: 20, height: 5 \}/)
    expect(edgeFunction).not.toContain('/ship/generate/')
  })

  it('cierra tablas de quotes y rate limit para roles públicos', () => {
    expect(migration).toMatch(/ENABLE ROW LEVEL SECURITY/g)
    expect(migration).toMatch(/REVOKE ALL ON TABLE public\.shipping_quotes FROM PUBLIC, anon, authenticated/)
    expect(migration).toMatch(/REVOKE ALL ON TABLE public\.shipping_quote_requests FROM PUBLIC, anon, authenticated/)
    expect(migration).toMatch(/GRANT ALL ON TABLE public\.shipping_quotes TO service_role/)
  })

  it('el pedido envía sólo quote id, nunca precio de envío del cliente', () => {
    const payload = buildCreateOrderPayload({
      idempotency_key: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      shipping_quote_id: '11111111-1111-4111-8111-111111111111',
      customer_name: 'Ana',
      customer_phone: '2995551234',
      lines: [{ line_type: 'product', product_id: 1, quantity: 1 }],
    })
    expect(payload.shipping_quote_id).toBe('11111111-1111-4111-8111-111111111111')
    expect(payload).not.toHaveProperty('shipping_amount')
    expect(payload).not.toHaveProperty('shipping_carrier')
  })

  it('mapea cotización vencida y consumida sin filtrar detalles internos', () => {
    expect(createOrderErrorFromRpc('shipping_quote_expired').message).toBe('shipping_quote_expired')
    expect(createOrderErrorFromRpc('shipping_quote_consumed').message).toBe('shipping_quote_consumed')
  })

  it('muestra centavos de las tarifas sin redondear el total', () => {
    expect(formatPesoARExact(10411.36)).toBe('10.411,36')
    expect(formatPesoARExact(1500)).toBe('1.500')
  })

  it('Stage 7.2 carga ubicaciones oficiales y recibe el CP del cliente', () => {
    expect(edgeFunction).toContain('https://apis.datos.gob.ar/georef/api/v2.0')
    expect(edgeFunction).not.toContain('https://nominatim.openstreetmap.org/search')
    expect(edgeFunction).toContain("text(body.postalCode)")
    expect(checkout).toContain('checkout-province')
    expect(checkout).toContain('checkout-locality')
    expect(checkout).toContain('checkout-street-number')
    expect(checkout).toContain('checkout-postal-code')
    expect(checkout).toContain('autoComplete="postal-code"')
    expect(checkout).not.toContain('Calculamos el código postal automáticamente')
    expect(checkout).not.toContain('Origen: Neuquén')
    expect(checkout).not.toContain('Localidades:')
    expect(checkout).not.toContain('OpenStreetMap contributors')
    expect(checkout).not.toContain('El sistema revalida')
    expect(checkout).not.toContain('Total estimado')
  })

  it('permite cargar provincias desde todos los aliases productivos de Vercel', () => {
    expect(edgeFunction).toContain("'https://ilarabeauty.vercel.app'")
    expect(edgeFunction).toContain('VERCEL_APP_ORIGIN.test(origin)')
    expect(edgeFunction).toContain('origin && !isAllowedOrigin(origin)')
  })

  it('Stage 7.1 conserva dirección completa y caché privado sin domicilio en claro', () => {
    expect(stage71Migration).toContain('destination_formatted_address')
    expect(stage71Migration).toContain('shipping_destination_formatted_address')
    expect(stage71Migration).toContain('shipping_geocode_cache')
    expect(stage71Migration).toMatch(/query_hash text PRIMARY KEY/)
    expect(stage71Migration).toMatch(/REVOKE ALL ON TABLE public\.shipping_geocode_cache FROM PUBLIC, anon, authenticated/)
  })

  it('Stage 7.2 permite conservar una dirección sin coordenadas', () => {
    expect(stage72Migration).toContain('DROP CONSTRAINT shipping_quotes_structured_address')
    expect(stage72Migration).toContain('DROP CONSTRAINT orders_structured_shipping_address')
    expect(stage72Migration).toMatch(/destination_lat IS NULL\s+AND destination_lon IS NULL/)
    expect(stage72Migration).toMatch(/shipping_destination_lat IS NULL\s+AND shipping_destination_lon IS NULL/)
  })
})
