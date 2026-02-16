#!/usr/bin/env node
/**
 * Copia public/logo_icon.png a icon-192.png, icon-512.png y apple-touch-icon.png
 * para que la PWA no devuelva 404. Ejecutar: node scripts/copy-pwa-icons.js
 * (Para tamaños exactos 192/512/180, usar una herramienta externa de redimensionado.)
 */

const fs = require('fs')
const path = require('path')

const publicDir = path.join(__dirname, '..', 'public')
const source = path.join(publicDir, 'logo_icon.png')
const targets = ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']

if (!fs.existsSync(source)) {
  console.warn('No se encontró public/logo_icon.png. Saltando copia de iconos PWA.')
  process.exit(0)
}

targets.forEach((name) => {
  const dest = path.join(publicDir, name)
  fs.copyFileSync(source, dest)
  console.log('Copiado:', name)
})

console.log('Listo. Si querés tamaños exactos (192x192, 512x512, 180x180), redimensioná con una herramienta externa.')
