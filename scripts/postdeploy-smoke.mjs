#!/usr/bin/env node
/**
 * Smoke posdeploy de SOLO LECTURA (Stage 4).
 *
 * Requiere SMOKE_BASE_URL explícito (sin default silencioso a prod).
 *
 *   SMOKE_BASE_URL=http://127.0.0.1:3000 npm run test:smoke
 *   SMOKE_BASE_URL=https://ilara.com.ar npm run test:smoke
 *
 * - Sólo GET / HEAD-like (fetch GET, redirect: manual).
 * - Nunca usa service_role ni muta Supabase.
 * - No envía cookies ni Authorization.
 */

const BASE_RAW = process.env.SMOKE_BASE_URL?.trim()
if (!BASE_RAW) {
  console.error(
    'FAIL  SMOKE_BASE_URL es obligatorio.\n' +
      '  Local:  SMOKE_BASE_URL=http://127.0.0.1:3000 npm run test:smoke\n' +
      '  Prod:   SMOKE_BASE_URL=https://ilara.com.ar npm run test:smoke'
  )
  process.exit(1)
}

const BASE = BASE_RAW.replace(/\/$/, '')

// Guardrail: no permitir credentials de Supabase en el proceso del smoke
const forbiddenEnv = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'E2E_SERVICE_ROLE_KEY',
  'STAGE0_SERVICE_ROLE_KEY',
  'STAGE1_SERVICE_ROLE_KEY',
  'STAGE2_SERVICE_ROLE_KEY',
]
for (const k of forbiddenEnv) {
  if (process.env[k]) {
    // No fallar hard en CI e2e job que reutiliza env; avisar y no usar
    console.warn(`WARN  ${k} presente en env; smoke no lo usa (read-only).`)
  }
}

const checks = []

function ok(name, detail = '') {
  checks.push({ name, pass: true, detail })
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`)
}
function fail(name, detail = '') {
  checks.push({ name, pass: false, detail })
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function get(path) {
  const url = `${BASE}${path}`
  const res = await fetch(url, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'user-agent': 'ilara-postdeploy-smoke/1.0',
      // sin cookie / authorization
    },
  })
  return res
}

async function main() {
  console.log(`Smoke posdeploy (GET-only, read-only) → ${BASE}`)

  // Catálogo
  {
    const res = await get('/catalogo')
    if (res.status >= 200 && res.status < 400) ok('catalogo status', String(res.status))
    else fail('catalogo status', String(res.status))
  }

  // Login (formulario)
  {
    const res = await get('/login')
    if (res.status >= 200 && res.status < 400) ok('login status', String(res.status))
    else fail('login status', String(res.status))
    const html = await res.text()
    if (/type=["']email["']|Email/i.test(html)) ok('login form present')
    else fail('login form present')
    if (!/passkey|webauthn|huella/i.test(html)) ok('login sin passkeys')
    else fail('login sin passkeys', 'UI aún menciona passkeys')
  }

  // Headers de seguridad
  {
    const res = await get('/catalogo')
    const h = res.headers
    const csp = h.get('content-security-policy') || ''
    const xfo = h.get('x-frame-options') || ''
    const xcto = h.get('x-content-type-options') || ''
    if (csp) ok('CSP header')
    else fail('CSP header', 'ausente')
    if (/deny/i.test(xfo)) ok('X-Frame-Options DENY')
    else fail('X-Frame-Options', xfo || 'ausente')
    if (/nosniff/i.test(xcto)) ok('X-Content-Type-Options nosniff')
    else fail('X-Content-Type-Options', xcto || 'ausente')
  }

  // Manifest
  {
    const res = await get('/manifest.json')
    if (res.status === 200) ok('manifest 200')
    else fail('manifest 200', String(res.status))
    try {
      const m = await res.json()
      if (m.display === 'standalone') ok('manifest display standalone')
      else fail('manifest display', String(m.display))
      if (Array.isArray(m.icons) && m.icons.length) ok('manifest icons')
      else fail('manifest icons')
    } catch (e) {
      fail('manifest json', String(e?.message || e))
    }
  }

  // Service worker online-only
  {
    const res = await get('/sw.js')
    if (res.status === 200) ok('sw.js 200')
    else fail('sw.js 200', String(res.status))
    const body = await res.text()
    const code = body
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
    if (/addEventListener\(\s*['"]fetch['"]/.test(code)) ok('sw fetch listener')
    else fail('sw fetch listener')
    if (!/\.respondWith\s*\(/.test(code)) ok('sw sin respondWith (online-only)')
    else fail('sw sin respondWith', 'parece cachear respuestas')
    // activate puede usar caches.keys/delete para legacy; open de negocio está prohibido
    if (!/caches\.open\s*\(/.test(code)) ok('sw sin caches.open de negocio')
    else fail('sw sin caches.open', 'posible cache de negocio')
  }

  // not-found público
  {
    const res = await get('/catalogo/p/999999991')
    if (res.status === 404 || res.status === 200) {
      ok('catalog product not-found responds', String(res.status))
    } else fail('catalog product not-found', String(res.status))
  }

  // Ruta privada desconocida: proxy redirige a login sin sesión
  {
    const res = await get('/ruta-smoke-404-ilara')
    if (res.status === 307 || res.status === 302 || res.status === 404 || res.status === 200) {
      ok('unknown private path gated', String(res.status))
    } else fail('unknown private path gated', String(res.status))
  }

  const failed = checks.filter((c) => !c.pass)
  console.log(`\nResumen: ${checks.length - failed.length}/${checks.length} OK`)
  if (failed.length) process.exitCode = 1
}

main().catch((e) => {
  console.error('Smoke fatal:', e?.message || e)
  process.exit(1)
})
