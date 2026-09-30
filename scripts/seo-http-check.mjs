#!/usr/bin/env node
/**
 * Comprobaciones HTTP de sólo lectura para el paquete SEO.
 * No usa service_role ni muta datos de negocio.
 *
 *   SEO_BASE_URL=http://127.0.0.1:3000 node scripts/seo-http-check.mjs
 *
 * Fallos transitorios: el servidor debe arrancarse con ILARA_ALLOW_SEO_FAULT=1.
 * Este script escribe `.seo-fault-local` en el cwd; no hay parámetro público de URL.
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE_RAW = process.env.SEO_BASE_URL?.trim()
if (!BASE_RAW) {
  console.error('FAIL  SEO_BASE_URL es obligatorio (p. ej. http://127.0.0.1:3000)')
  process.exit(1)
}
const BASE = BASE_RAW.replace(/\/$/, '')
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(BASE).hostname)
if (/ilara\.com\.ar/i.test(BASE) && process.env.SEO_ALLOW_PROD !== '1') {
  console.error('FAIL  este chequeo no apunta a producción salvo SEO_ALLOW_PROD=1')
  process.exit(1)
}

const FAULT_FILE = resolve(process.cwd(), '.seo-fault-local')
const previousFault = isLocal && existsSync(FAULT_FILE) ? readFileSync(FAULT_FILE) : null

const rows = []

function productIds(body) {
  return [...new Set([...body.matchAll(/href="\/catalogo\/p\/(\d+)"/g)].map((m) => m[1]))]
}

function writeFault(text) {
  if (!isLocal) throw new Error('Fault injection is restricted to loopback')
  writeFileSync(FAULT_FILE, text, 'utf8')
}

function clearFault() {
  if (isLocal) writeFileSync(FAULT_FILE, '', 'utf8')
}

function statusMatches(expected, got) {
  if (typeof expected === 'function') return expected(got)
  if (Array.isArray(expected)) return expected.includes(got)
  return expected === got
}

function record(name, url, expected, got) {
  const reasons = []
  if (expected.status != null && !statusMatches(expected.status, got.status)) {
    reasons.push(`status ${got.status} != ${expected.status}`)
  }
  if (expected.robots == null && /\bnoindex\b/i.test(got.robots || '') && expected.allowNoindex !== true) {
    if (expected.forbidNoindex) reasons.push(`robots noindex inesperado (${got.robots})`)
  }
  if (expected.robots != null && !(got.robots || '').includes(expected.robots)) {
    reasons.push(`robots ${got.robots || '-'} != ${expected.robots}`)
  }
  if (expected.canonical != null && got.canonical !== expected.canonical) {
    reasons.push(`canonical ${got.canonical || '-'} != ${expected.canonical}`)
  }
  if (expected.has) {
    for (const s of expected.has) {
      if (!got.body.includes(s)) reasons.push(`falta ${JSON.stringify(s)}`)
    }
  }
  if (expected.missing) {
    for (const s of expected.missing) {
      if (got.body.includes(s)) reasons.push(`no debía incluir ${JSON.stringify(s)}`)
    }
  }
  if (expected.locationIncludes && !(got.location || '').includes(expected.locationIncludes)) {
    reasons.push(`Location ${got.location || '-'} no incluye ${expected.locationIncludes}`)
  }
  if (typeof expected.check === 'function') {
    const extra = expected.check(got)
    if (extra) reasons.push(extra)
  }
  const pass = reasons.length === 0
  rows.push({
    name,
    url,
    expected: expected.status,
    got: got.status,
    robots: got.robots,
    canonical: got.canonical,
    pass,
    reasons,
  })
  const line = `${pass ? 'PASS' : 'FAIL'}  ${name} — HTTP ${got.status} (esperado ${expected.status}) robots=${got.robots || '-'} canon=${got.canonical || '-'}`
  if (pass) console.log(line)
  else console.error(`${line} :: ${reasons.join('; ')}`)
}

async function fetchPage(path) {
  const url = `${BASE}${path}`
  const res = await fetch(url, { redirect: 'manual', headers: { 'user-agent': 'ilara-seo-http-check/1.0' } })
  const body = await res.text()
  const robots = body.match(/name=["']robots["'] content=["']([^"']+)/i)?.[1] || null
  const canonical = body.match(/rel=["']canonical["'] href=["']([^"']+)/i)?.[1] || null
  return {
    status: res.status,
    body,
    robots,
    canonical,
    headers: res.headers,
    location: res.headers.get('location'),
    cacheControl: res.headers.get('cache-control'),
  }
}

async function main() {
  console.log(`SEO HTTP check → ${BASE}`)
  clearFault()

  const catalog = await fetchPage('/catalogo')
  const idsPage1 = productIds(catalog.body)
  record('catálogo página 1', '/catalogo', {
    status: 200,
    robots: 'index, follow',
    canonical: 'https://ilara.com.ar/catalogo',
    has: ['Un poco de color', '/catalogo/p/'],
    missing: ['Todos los productos'],
    check: () => idsPage1.length >= 15 ? null : `esperaba ≥15 productos en HTML, hay ${idsPage1.length}`,
  }, catalog)

  const page2 = await fetchPage('/catalogo?page=2')
  const idsPage2 = productIds(page2.body)
  record('catálogo página 2', '/catalogo?page=2', {
    status: 200,
    robots: 'index, follow',
    canonical: 'https://ilara.com.ar/catalogo?page=2',
    has: ['aria-current="page"'],
    check: (got) => {
      if (idsPage2.length === 0) return 'página 2 sin productos en HTML'
      if (idsPage1.length && idsPage2.join(',') === idsPage1.join(',')) {
        return `página 2 repite los mismos ${idsPage2.length} productos que página 1`
      }
      const overlap = idsPage2.filter((id) => idsPage1.includes(id))
      if (overlap.length) return `página 2 comparte IDs con página 1: ${overlap.join(',')}`
      if (/\bnoindex\b/i.test(got.robots || '')) return 'página 2 no debe llevar noindex'
      return null
    },
  }, page2)

  const search = await fetchPage('/catalogo?q=inexistenteprueba')
  record('búsqueda sin resultados', '/catalogo?q=inexistenteprueba', {
    status: 200,
    robots: 'noindex, follow',
    canonical: 'https://ilara.com.ar/catalogo?q=inexistenteprueba',
    has: ['No encontramos productos', 'inexistenteprueba'],
    missing: ['Todos los productos'],
    check: (got) => productIds(got.body).length === 0 ? null : 'la búsqueda vacía no debe listar fichas',
  }, search)

  const sorted = await fetchPage('/catalogo?sort=precio-asc')
  record('orden alternativo noindex', '/catalogo?sort=precio-asc', {
    status: 200,
    robots: 'noindex, follow',
    canonical: 'https://ilara.com.ar/catalogo?sort=precio-asc',
    has: ['value="precio-asc"', 'Precio: menor a mayor'],
  }, sorted)

  const combos = await fetchPage('/catalogo?cat=combos')
  record('filtro combos noindex', '/catalogo?cat=combos', {
    status: 200,
    robots: 'noindex, follow',
    canonical: 'https://ilara.com.ar/catalogo?cat=combos',
    has: ['Combos'],
  }, combos)

  const page1Query = await fetchPage('/catalogo?page=1')
  record('página 1 con query se normaliza', '/catalogo?page=1', {
    status: 307,
    locationIncludes: '/catalogo',
    check: (got) => {
      const loc = got.location || ''
      if (/[?&]page=/.test(loc)) return `Location todavía tiene page: ${loc}`
      return null
    },
  }, page1Query)

  const invalidSort = await fetchPage('/catalogo?sort=nope')
  record('sort inválido se normaliza', '/catalogo?sort=nope', {
    status: 307,
    locationIncludes: '/catalogo',
  }, invalidSort)

  const outOfRange = await fetchPage('/catalogo?page=99')
  record('página fuera de rango', '/catalogo?page=99', {
    status: 404,
    robots: 'noindex',
    missing: ['Un poco de color'],
  }, outOfRange)

  const productMatch = catalog.body.match(/href="(\/catalogo\/p\/\d+)"/)
  const productPath = productMatch?.[1] || '/catalogo/p/86'
  const product = await fetchPage(productPath)
  const offerPrice = product.body.match(/"@type":"Offer"[^}]*"price":\s*"?(\d+(?:\.\d+)?)/)
    || product.body.match(/"price":\s*"?(\d+(?:\.\d+)?)/)
  record('ficha válida', productPath, {
    status: 200,
    robots: 'index, follow',
    canonical: `https://ilara.com.ar${productPath}`,
    has: ['"@type":"Product"', '"@type":"Offer"', '"priceCurrency":"ARS"', '"name":"Ilara Beauty"'],
    missing: ['FreeReturn', 'MerchantReturnFiniteReturnWindow', 'SCHEMA_FALLBACK', 'noindex'],
    check: (got) => {
      if (/\bnoindex\b/i.test(got.robots || '')) return 'ficha válida no debe llevar noindex'
      if (!offerPrice) return 'no se leyó Offer.price'
      return null
    },
  }, product)

  const missing = await fetchPage('/catalogo/p/999999991')
  record('ficha inexistente', '/catalogo/p/999999991', {
    status: 404,
    robots: 'noindex',
    missing: ['"@type":"Product"', '"@type":"Offer"'],
  }, missing)

  const malformed = await fetchPage('/catalogo/p/86abc')
  record('id malformado', '/catalogo/p/86abc', {
    status: 404,
    robots: 'noindex',
    missing: ['"@type":"Product"'],
  }, malformed)

  const transientId = '123456789'
  if (isLocal) {
  writeFault(`product ${transientId}\n`)
  const transient = await fetchPage(`/catalogo/p/${transientId}`)
  record('falla temporal de ficha', `/catalogo/p/${transientId}`, {
    status: (s) => s >= 500,
    forbidNoindex: true,
    missing: ['"@type":"Product"', '"@type":"Offer"', 'Producto no encontrado', 'noindex'],
    check: (got) => {
      if (got.status < 500) {
        return `se esperaba 5xx (Next 16 responde 500 al lanzar en el servidor). Si dio ${got.status}, ¿el server arrancó con ILARA_ALLOW_SEO_FAULT=1?`
      }
      if (/\bnoindex\b/i.test(got.robots || '') || /\bnoindex\b/i.test(got.body)) {
        return 'un 5xx no debe ordenar noindex'
      }
      const recoverable = got.body.includes('No pudimos cargar este producto')
        || got.body.includes('Internal Server Error')
      if (!recoverable) return 'el cuerpo no parece un error transitorio'
      if ((got.cacheControl || '').includes('public') && (got.cacheControl || '').includes('s-maxage')) {
        return `caché pública inesperada en error: ${got.cacheControl}`
      }
      return null
    },
  }, transient)

  clearFault()
  const recoveredMissing = await fetchPage(`/catalogo/p/${transientId}`)
  record('recuperación: id de prueba no queda como error', `/catalogo/p/${transientId}`, {
    status: 404,
    robots: 'noindex',
    missing: ['No pudimos cargar este producto', '"@type":"Product"'],
  }, recoveredMissing)

  const recoveredValid = await fetchPage(productPath)
  record('recuperación: ficha válida sigue 200 indexable', productPath, {
    status: 200,
    robots: 'index, follow',
    canonical: `https://ilara.com.ar${productPath}`,
    has: ['"@type":"Product"', '"@type":"Offer"'],
    missing: ['noindex', 'No pudimos cargar este producto'],
  }, recoveredValid)
  }

  const sitemap = await fetchPage('/sitemap.xml')
  const sitemapOk = sitemap.status === 200
    && sitemap.body.includes('<urlset')
    && sitemap.body.includes('https://ilara.com.ar/catalogo')
    && sitemap.body.includes('/catalogo/p/')
    && !sitemap.body.includes('<lastmod>')
    && !sitemap.body.includes('/pedido')
    && !sitemap.body.includes('vercel.app')
  rows.push({
    name: 'sitemap con productos',
    url: '/sitemap.xml',
    expected: 200,
    got: sitemap.status,
    robots: null,
    canonical: null,
    pass: sitemapOk,
    reasons: sitemapOk ? [] : ['urlset/productos/host inesperados'],
  })
  console.log(`${sitemapOk ? 'PASS' : 'FAIL'}  sitemap con productos — HTTP ${sitemap.status}`)

  if (isLocal) {
  writeFault('sitemap empty\n')
  const sitemapEmpty = await fetchPage('/sitemap.xml')
  const emptyOk = sitemapEmpty.status === 200
    && sitemapEmpty.body.includes('https://ilara.com.ar/catalogo')
    && !sitemapEmpty.body.includes('/catalogo/p/')
  rows.push({
    name: 'sitemap vacío válido',
    url: '/sitemap.xml',
    expected: 200,
    got: sitemapEmpty.status,
    pass: emptyOk,
    reasons: emptyOk ? [] : ['vacío válido debía ser 200 sólo con /catalogo'],
  })
  console.log(`${emptyOk ? 'PASS' : 'FAIL'}  sitemap vacío válido — HTTP ${sitemapEmpty.status}`)

  writeFault('sitemap error\n')
  const sitemapFail = await fetchPage('/sitemap.xml')
  const failOk = sitemapFail.status === 503
    && (sitemapFail.headers.get('retry-after') === '300')
    && /no-store/i.test(sitemapFail.headers.get('cache-control') || '')
    && !sitemapFail.body.includes('/catalogo/p/')
  rows.push({
    name: 'sitemap fallo temporal',
    url: '/sitemap.xml',
    expected: 503,
    got: sitemapFail.status,
    pass: failOk,
    reasons: failOk ? [] : [`status ${sitemapFail.status}, retry-after=${sitemapFail.headers.get('retry-after')}`],
  })
  console.log(`${failOk ? 'PASS' : 'FAIL'}  sitemap fallo temporal — HTTP ${sitemapFail.status}`)

  clearFault()
  const sitemapRestored = await fetchPage('/sitemap.xml')
  const restoredOk = sitemapRestored.status === 200 && sitemapRestored.body.includes('/catalogo/p/')
  rows.push({
    name: 'sitemap se recupera',
    url: '/sitemap.xml',
    expected: 200,
    got: sitemapRestored.status,
    pass: restoredOk,
    reasons: restoredOk ? [] : ['después del fallo debía volver el inventario'],
  })
  console.log(`${restoredOk ? 'PASS' : 'FAIL'}  sitemap se recupera — HTTP ${sitemapRestored.status}`)
  }

  const robotsTxt = await fetchPage('/robots.txt')
  const robotsOk = robotsTxt.status === 200
    && robotsTxt.body.includes('Sitemap: https://ilara.com.ar/sitemap.xml')
    && robotsTxt.body.includes('Disallow: /pedido')
  rows.push({ name: 'robots.txt', url: '/robots.txt', expected: 200, got: robotsTxt.status, pass: robotsOk })
  console.log(`${robotsOk ? 'PASS' : 'FAIL'}  robots.txt — HTTP ${robotsTxt.status}`)

  const login = await fetchPage('/login')
  record('login noindex', '/login', { status: 200, robots: 'noindex' }, login)

  const failed = rows.filter((r) => !r.pass)
  console.log(`\nResumen: ${rows.length - failed.length}/${rows.length} OK`)
  if (failed.length) process.exitCode = 1
}

main()
  .catch((e) => {
    console.error('SEO HTTP fatal:', e?.message || e)
    process.exitCode = 1
  })
  .finally(() => {
    if (!isLocal) return
    try {
      if (previousFault != null) writeFileSync(FAULT_FILE, previousFault)
      else if (existsSync(FAULT_FILE)) unlinkSync(FAULT_FILE)
    } catch { /* ignore */ }
  })
