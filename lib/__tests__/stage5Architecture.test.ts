import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  assertNoInternalPublicKeys,
  mapPublicCatalogProduct,
  PUBLIC_CATALOG_FORBIDDEN_KEYS,
} from '../domain/catalog/publicDto'
import {
  buildCreateSalePayload,
  createSaleErrorFromRpc,
  parseCreateSaleRpcResult,
} from '../domain/sales/createSale'
import { CATALOG_PRODUCT_SELECT } from '../catalog/publicCatalogSelect'
import type { ItemCarrito } from '../domain/types'

const ROOT = join(__dirname, '../..')

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dist') continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walkTsFiles(p, acc)
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) acc.push(p)
  }
  return acc
}

describe('Stage 5 — DTO público de catálogo', () => {
  it('mapPublicCatalogProduct elimina purchase_price y campos internos', () => {
    const mapped = mapPublicCatalogProduct({
      id: 9,
      name: 'Labial',
      brand: 'X',
      color: null,
      sale_price: 2500,
      stock: 3,
      category_id: 1,
      image_url: null,
      image_urls: null,
      discount_percentage: 10,
      catalog_badge: null,
      visible_in_catalog: true,
      created_at: '2026-01-01T00:00:00Z',
      purchase_price: 999,
      notes: 'secreto',
      min_stock: 1,
      created_by: 'u1',
      updated_by: 'u2',
      updated_at: '2026-01-02T00:00:00Z',
      categories: { name: 'Maquillaje' },
    })
    assertNoInternalPublicKeys(mapped)
    for (const k of PUBLIC_CATALOG_FORBIDDEN_KEYS) {
      expect(mapped).not.toHaveProperty(k)
    }
    expect(mapped.id).toBe(9)
    expect(mapped.sale_price).toBe(2500)
    expect(mapped.categories?.name).toBe('Maquillaje')
  })

  it('CATALOG_PRODUCT_SELECT no lista columnas internas', () => {
    for (const col of PUBLIC_CATALOG_FORBIDDEN_KEYS) {
      const asField = new RegExp(`(^|[,\\s(])${col}([,\\s)]|$)`)
      expect(CATALOG_PRODUCT_SELECT).not.toMatch(asField)
    }
  })
})

describe('Stage 5 — createSale payload y errores', () => {
  const producto = {
    id: 1,
    name: 'P1',
    category_id: null,
    brand: null,
    color: null,
    purchase_price: 10,
    sale_price: 100,
    stock: 5,
    min_stock: 0,
    image_url: null,
    notes: null,
    created_at: '',
    updated_at: '',
  }

  it('buildCreateSalePayload arma lines sin unit_price autoritativo', () => {
    const carrito: ItemCarrito[] = [{ producto, cantidad: 2 }]
    const payload = buildCreateSalePayload({
      carrito,
      clienteSeleccionado: null,
      nombreClienteOtro: 'Ana',
      clientes: [],
      metodoPago: 'efectivo',
      paymentBreakdown: null,
      cobrarDespues: false,
      notas: '',
    })
    expect(payload.sale.customer_name).toBe('Ana')
    expect(payload.sale.payment_method).toBe('efectivo')
    expect(payload.lines).toEqual([
      { line_type: 'product', product_id: 1, quantity: 2 },
    ])
    expect(JSON.stringify(payload.lines)).not.toMatch(/unit_price/)
  })

  it('cobrar después usa credito y pending_payment', () => {
    const payload = buildCreateSalePayload({
      carrito: [{ producto, cantidad: 1 }],
      clienteSeleccionado: null,
      nombreClienteOtro: '',
      clientes: [],
      metodoPago: 'tarjeta',
      paymentBreakdown: null,
      cobrarDespues: true,
      notas: 'x',
    })
    expect(payload.sale.payment_method).toBe('credito')
    expect(payload.sale.status).toBe('pending_payment')
  })

  it('parseCreateSaleRpcResult exige sale.id', () => {
    expect(() => parseCreateSaleRpcResult({ sale: {} })).toThrow()
    const r = parseCreateSaleRpcResult({
      sale: {
        id: 42,
        total: 100,
        customer_name: null,
        payment_method: 'efectivo',
        notes: null,
        sale_date: '2026-01-01',
        created_at: '2026-01-01',
      },
      lines: [{ product_name: 'P', quantity: 1, unit_price: 100, subtotal: 100 }],
    })
    expect(r.sale.id).toBe(42)
    expect(r.lines).toHaveLength(1)
  })

  it('createSaleErrorFromRpc mapea stock y auth', () => {
    expect(createSaleErrorFromRpc('insufficient_stock for product 1').code).toBe('stock')
    expect(createSaleErrorFromRpc('not_authenticated').code).toBe('auth')
    expect(createSaleErrorFromRpc('not_authorized').code).toBe('forbidden')
  })
})

describe('Stage 5 — frontera server-only / service role', () => {
  it('lib/ y app/ no leen SERVICE_ROLE_KEY ni crean client service-role', () => {
    const roots = [join(ROOT, 'lib'), join(ROOT, 'app'), join(ROOT, 'components'), join(ROOT, 'hooks')]
    const offenders: string[] = []
    for (const root of roots) {
      for (const file of walkTsFiles(root)) {
        if (file.includes(`${join('lib', '__tests__')}`)) continue
        // Sanitización puede mencionar service_role como patrón a redactar
        const rel = file.replace(/\\/g, '/')
        if (rel.endsWith('lib/observability/sanitize.ts')) continue
        // Job interno de expiración y URL firmada de comprobante. Nunca se importa desde cliente.
        if (rel.endsWith('lib/supabase/service.ts')) continue
        const text = readFileSync(file, 'utf8')
        if (/process\.env\.(SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY)/.test(text)) {
          offenders.push(file.replace(ROOT, ''))
        }
        if (/createClient\([^)]*SERVICE_ROLE|createClient\([^)]*service_role/i.test(text)) {
          offenders.push(file.replace(ROOT, ''))
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('módulos server-only marcan la directiva', () => {
    for (const rel of [
      'lib/supabase/server.ts',
      'lib/supabase/public.ts',
      'lib/catalog/serverCatalog.ts',
      'lib/dal/auth.ts',
      'lib/dal/catalog.ts',
      'lib/dal/orders.ts',
      'lib/dal/payments.ts',
      'lib/supabase/service.ts',
    ]) {
      const text = readFileSync(join(ROOT, rel), 'utf8')
      expect(text, rel).toMatch(/import ['"]server-only['"]/)
    }
  })

  it('lib/supabase.ts barril no exporta createSupabaseServer/Public', () => {
    const text = readFileSync(join(ROOT, 'lib/supabase.ts'), 'utf8')
    expect(text).not.toMatch(/export\s+\{[^}]*createSupabaseServerClient/)
    expect(text).not.toMatch(/export\s+\{[^}]*createSupabasePublicClient/)
    expect(text).not.toMatch(/from ['"]@\/lib\/supabase\/server['"]/)
    expect(text).not.toMatch(/from ['"]@\/lib\/supabase\/public['"]/)
  })
})
