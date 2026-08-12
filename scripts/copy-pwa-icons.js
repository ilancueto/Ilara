#!/usr/bin/env node
/**
 * @deprecated Preferí `npm run pwa-icons` → scripts/generate-pwa-icons.mjs
 * Mantiene compatibilidad: redirige a generación con redimensionado real.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { spawnSync } = require('child_process')
const path = require('path')

const script = path.join(__dirname, 'generate-pwa-icons.mjs')
const result = spawnSync(process.execPath, [script], { stdio: 'inherit' })
process.exit(result.status ?? 1)
