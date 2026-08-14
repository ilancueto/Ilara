/**
 * Stage 2 — matriz de seguridad de base (anon / authenticated / service_role).
 * No imprime tokens ni PII. Falla si detecta superficie anónima sensible.
 *
 * Uso (local):
 *   node --env-file=.env.local scripts/db-security-matrix.mjs
 *   o con vars STAGE2_* / STAGE0_* / NEXT_PUBLIC_* / SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js'

const PROD_REFS = ['qbbnvdmadgomfmrsfxlo']

const url =
  process.env.STAGE2_SUPABASE_URL?.trim() ||
  process.env.STAGE0_SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const anonKey =
  process.env.STAGE2_ANON_KEY?.trim() ||
  process.env.STAGE0_ANON_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
const serviceKey =
  process.env.STAGE2_SERVICE_ROLE_KEY?.trim() ||
  process.env.STAGE0_SERVICE_ROLE_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

function fail(msg) {
  console.error(`FAIL: ${msg}`)
  process.exit(1)
}

function ok(msg) {
  console.log(`OK: ${msg}`)
}

function isProd(target) {
  if (!target) return false
  return PROD_REFS.some((r) => target.toLowerCase().includes(r))
}

function isDenied(error) {
  if (!error) return false
  const code = String(error.code || '')
  const msg = String(error.message || '').toLowerCase()
  return (
    code === '42501' ||
    code === 'PGRST301' ||
    code === 'PGRST116' ||
    /permission denied|not authorized|row-level security|rls|forbidden|access denied|privileg|jwt/i.test(
      msg
    )
  )
}

if (!url || !anonKey) {
  fail('URL y anon key requeridos (sin imprimir valores)')
}
if (isProd(url)) {
  fail('Rechazado: no ejecutar matriz mutante/probe contra proyecto productivo')
}

const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// --- anon: superficies sensibles ---
const sensitiveTables = [
  'sales',
  'sale_items',
  'expenses',
  'customers',
  'incomes',
  'stock_movements',
  // Stage 6.1 — pedidos: sin lectura anónima
  'orders',
  'order_items',
  'order_status_events',
  // Stage 6.2 — alertas de stock: sin lectura anónima
  'stock_alerts',
  'stock_alert_events',
  // Stage 6.3 — devoluciones: documentos financieros solo admin
  'sale_returns',
  'sale_return_items',
  'sale_return_events',
  // Stage 6.5 — CRM sensible sin acceso directo
  'customer_tags',
  'customer_tag_assignments',
  'customer_notes',
  'customer_consent_events',
  // Stage 6.6 — ledger financiero sin acceso directo
  'financial_accounts',
  'financial_movements',
  // Stage 7 — cotizaciones y rate limit sólo backend
  'shipping_quotes',
  'shipping_quote_requests',
]
for (const table of sensitiveTables) {
  const { data, error } = await anon.from(table).select('*').limit(1)
  if (!error && data && data.length > 0) {
    fail(`anon pudo leer filas de ${table}`)
  }
  if (!error && (!data || data.length === 0)) {
    // lista vacía sin error puede ser RLS que filtra todo; preferimos denegación de grant
    // pero aceptamos 0 filas solo si no hay datos; exigir error de privilegio es más fuerte
    fail(`anon obtuvo respuesta sin error de privilegio en ${table} (esperaba deny)`)
  }
  if (!isDenied(error)) {
    fail(`anon error inesperado en ${table}: code=${error?.code || '?'}`)
  }
  ok(`anon denegado en ${table}`)
}

// --- anon: columnas internas de products ---
for (const cols of ['purchase_price', 'notes', 'min_stock', 'created_by', 'updated_by']) {
  const { error } = await anon.from('products').select(`id, ${cols}`).limit(1)
  if (!error) {
    fail(`anon pudo seleccionar products.${cols}`)
  }
  ok(`anon no selecciona products.${cols}`)
}

// --- anon: catálogo público ---
{
  const { data, error } = await anon
    .from('products')
    .select('id, name, sale_price, image_url, visible_in_catalog')
    .eq('visible_in_catalog', true)
    .limit(5)
  if (error) fail(`anon catálogo products falló: ${error.code || 'err'}`)
  ok(`anon lee columnas públicas de products (n=${data?.length ?? 0})`)
}

{
  const { data, error } = await anon.from('categories').select('id, name').limit(5)
  if (error) fail(`anon categories falló: ${error.code || 'err'}`)
  ok(`anon lee categories (n=${data?.length ?? 0})`)
}

{
  const { data, error } = await anon.rpc('catalog_sales_by_product')
  if (error) fail(`anon catalog_sales_by_product falló: ${error.code || 'err'}`)
  ok(`anon ejecuta catalog_sales_by_product (n=${Array.isArray(data) ? data.length : 0})`)
}

{
  const { error } = await anon.rpc('sales_margin_report', {
    p_from: '2026-01-01',
    p_to: '2026-01-01',
  })
  if (!isDenied(error)) fail(`anon sales_margin_report no fue denegado: code=${error?.code || '?'}`)
  ok('anon denegado en sales_margin_report')
}

{
  const { error } = await anon.rpc('customer_crm_profile', { p_customer_id: 1 })
  if (!isDenied(error)) fail(`anon customer_crm_profile no fue denegado: code=${error?.code || '?'}`)
  ok('anon denegado en customer_crm_profile')
}

{
  const { error } = await anon.rpc('finance_stage66_snapshot', {
    p_from: '2026-01-01', p_to: '2026-01-01',
  })
  if (!isDenied(error)) fail(`anon finance_stage66_snapshot no fue denegado: code=${error?.code || '?'}`)
  ok('anon denegado en finance_stage66_snapshot')
}

// --- service_role: RLS bypasseable; comprueba tablas core ---
if (serviceKey) {
  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const core = [
    'products', 'sales', 'user_roles', 'incomes', 'stock_movements',
    'sale_item_components', 'sale_returns', 'sale_return_items', 'sale_return_events',
    'customer_tags', 'customer_tag_assignments', 'customer_notes', 'customer_consent_events',
    'financial_accounts', 'financial_movements',
    'shipping_quotes', 'shipping_quote_requests',
  ]
  for (const table of core) {
    const { error } = await service.from(table).select('*', { count: 'exact', head: true })
    if (error) fail(`service_role no puede head ${table}: ${error.code || 'err'}`)
    ok(`service_role head ${table}`)
  }

  // RPC de venta sin auth debe fallar (DEFINER con auth.uid)
  const { error: saleErr } = await service.rpc('create_sale_with_items', {
    p_payload: { sale: {}, lines: [] },
  })
  // service role may still hit not_authenticated or empty_lines depending on path
  if (!saleErr) {
    fail('create_sale_with_items no debió tener éxito con payload vacío')
  }
  ok(`create_sale_with_items rechaza payload inválido (${saleErr.code || 'err'})`)
} else {
  console.log('SKIP: service_role checks (sin SERVICE_ROLE_KEY)')
}

// --- control negativo: detectar policy anónima permisiva si se inyecta en CI ---
// Este script NO crea policies. El job de CI usa un SQL temporal aparte.
if (process.env.STAGE2_EXPECT_INSECURE_POLICY === '1') {
  const { data, error } = await anon.from('sales').select('id').limit(1)
  if (error || !data) {
    fail('control negativo: se esperaba lectura anon de sales con policy insegura')
  }
  ok('control negativo: policy insegura detectada por lectura anon')
  process.exit(2) // código especial: "insecure surface found"
}

ok('matriz de seguridad de base completada')
process.exit(0)
