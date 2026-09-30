/**
 * Compara types/database.generated.ts con tipos regenerados desde staging en la nube.
 * Exit 1 si hay drift. No imprime secretos.
 */
import { generateCloudTypes } from './lib/cloud-types.mjs'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const committed = resolve(root, 'types/database.generated.ts')
const tmp = resolve(root, 'types/.database.generated.check.ts')

if (!existsSync(committed)) {
  console.error('FAIL: falta types/database.generated.ts — ejecutar npm run db:types')
  process.exit(1)
}

let types
try { types = generateCloudTypes(root) }
catch (error) { console.error(error.message); process.exit(1) }
writeFileSync(tmp, types, 'utf8')

function normalize(s) {
  return s.replace(/\r\n/g, '\n').trim() + '\n'
}

const a = normalize(readFileSync(committed, 'utf8'))
const b = normalize(readFileSync(tmp, 'utf8'))

try {
  unlinkSync(tmp)
} catch {
  /* ignore */
}

if (a !== b) {
  console.error('FAIL: drift de tipos DB. Ejecutar: npm run db:types y commitear el resultado.')
  process.exit(1)
}

console.log('OK: types/database.generated.ts coincide con el esquema de staging en la nube')
