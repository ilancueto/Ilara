#!/usr/bin/env node
/**
 * Verifica dimensiones reales de iconos PWA vs manifest.
 * Exit 1 si falla. No depende de red.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const publicDir = path.join(root, 'public')

const expected = [
  { file: 'icon-192.png', w: 192, h: 192 },
  { file: 'icon-512.png', w: 512, h: 512 },
  { file: 'icon-512-maskable.png', w: 512, h: 512 },
  { file: 'apple-touch-icon.png', w: 180, h: 180 },
]

const require = createRequire(import.meta.url)
let sharp
try {
  sharp = require('sharp')
} catch {
  // Fallback: parse PNG IHDR
  sharp = null
}

function pngSize(filePath) {
  const b = fs.readFileSync(filePath)
  if (b[0] !== 0x89 || b[1] !== 0x50) throw new Error('not png')
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
}

let failed = false
for (const item of expected) {
  const p = path.join(publicDir, item.file)
  if (!fs.existsSync(p)) {
    console.error(`MISSING ${item.file}`)
    failed = true
    continue
  }
  const size = sharp
    ? await sharp(p).metadata().then((m) => ({ width: m.width, height: m.height }))
    : pngSize(p)
  if (size.width !== item.w || size.height !== item.h) {
    console.error(`DIM ${item.file}: got ${size.width}x${size.height}, expected ${item.w}x${item.h}`)
    failed = true
  } else {
    console.log(`OK ${item.file} ${size.width}x${size.height}`)
  }
}

const manifestPath = path.join(publicDir, 'manifest.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
if (manifest.display !== 'standalone') {
  console.error('manifest.display must be standalone')
  failed = true
}
if (!manifest.icons?.length) {
  console.error('manifest.icons empty')
  failed = true
}
for (const icon of manifest.icons) {
  const rel = icon.src.replace(/^\//, '')
  if (!fs.existsSync(path.join(publicDir, rel))) {
    console.error(`manifest icon missing: ${icon.src}`)
    failed = true
  }
}

const swPath = path.join(publicDir, 'sw.js')
if (!fs.existsSync(swPath)) {
  console.error('MISSING public/sw.js')
  failed = true
} else {
  const swRaw = fs.readFileSync(swPath, 'utf8')
  // Strip block + line comments before scanning for forbidden APIs.
  const sw = swRaw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  if (/caches\.open|NetworkFirst|CacheFirst|defaultCache|precacheEntries/i.test(sw)) {
    console.error('sw.js appears to implement caching (forbidden for online-only)')
    failed = true
  }
  if (!/addEventListener\(\s*['"]fetch['"]/.test(sw)) {
    console.error('sw.js must register a fetch listener for Chromium installability')
    failed = true
  }
  if (/\.respondWith\s*\(/.test(sw)) {
    console.error('sw.js must not call respondWith (no fetch interception)')
    failed = true
  }
  if (!failed) console.log('OK public/sw.js online-only checks')
}

if (failed) process.exit(1)
console.log('PWA icon/manifest/sw checks passed')
