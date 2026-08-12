#!/usr/bin/env node
/**
 * Genera iconos PWA con dimensiones reales desde app/icon.png (o public/logo_icon.png).
 * Uso: node scripts/generate-pwa-icons.mjs
 *
 * Requiere `sharp` (viene con next). No copiar el mismo archivo con otro nombre.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const publicDir = path.join(root, 'public')
const candidates = [
  path.join(root, 'app', 'icon.png'),
  path.join(publicDir, 'logo_icon.png'),
]

const source = candidates.find((p) => fs.existsSync(p))
if (!source) {
  console.error('No se encontró fuente de icono (app/icon.png o public/logo_icon.png).')
  process.exit(1)
}

const require = createRequire(import.meta.url)
let sharp
try {
  sharp = require('sharp')
} catch {
  console.error('No se pudo cargar sharp. Ejecutá npm install.')
  process.exit(1)
}

const bg = { r: 253, g: 242, b: 248, alpha: 1 } // #fdf2f8

async function writeResized(size, destName) {
  const dest = path.join(publicDir, destName)
  await sharp(source).resize(size, size, { fit: 'cover' }).png().toFile(dest)
  const meta = await sharp(dest).metadata()
  console.log(`${destName}: ${meta.width}x${meta.height}`)
}

async function writeMaskable() {
  const dest = path.join(publicDir, 'icon-512-maskable.png')
  const canvas = 512
  const inner = 410
  const pad = Math.round((canvas - inner) / 2)
  const logo = await sharp(source).resize(inner, inner, { fit: 'cover' }).png().toBuffer()
  await sharp({
    create: { width: canvas, height: canvas, channels: 4, background: bg },
  })
    .composite([{ input: logo, left: pad, top: pad }])
    .png()
    .toFile(dest)
  const meta = await sharp(dest).metadata()
  console.log(`icon-512-maskable.png: ${meta.width}x${meta.height}`)
}

const meta = await sharp(source).metadata()
console.log(`Fuente: ${path.relative(root, source)} (${meta.width}x${meta.height})`)

await writeResized(192, 'icon-192.png')
await writeResized(512, 'icon-512.png')
await writeResized(180, 'apple-touch-icon.png')
await writeResized(32, 'favicon-32.png')
await writeMaskable()
console.log('Iconos PWA generados con dimensiones reales.')
