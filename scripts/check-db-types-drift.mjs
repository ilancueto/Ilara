/**
 * Compara types/database.generated.ts con tipos regenerados desde Supabase local.
 * Exit 1 si hay drift. No imprime secretos.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const committed = resolve(root, 'types/database.generated.ts')
const tmp = resolve(root, 'types/.database.generated.check.ts')

if (!existsSync(committed)) {
  console.error('FAIL: falta types/database.generated.ts — ejecutar npm run db:types')
  process.exit(1)
}

const gen = spawnSync(
  'npx supabase gen types typescript --local --schema public',
  { cwd: root, encoding: 'utf8', shell: true }
)

if (gen.status !== 0) {
  console.error('FAIL: supabase gen types --local')
  console.error(gen.stderr || gen.stdout || 'sin detalle')
  process.exit(1)
}

writeFileSync(tmp, gen.stdout, 'utf8')

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

console.log('OK: types/database.generated.ts coincide con el esquema local')
