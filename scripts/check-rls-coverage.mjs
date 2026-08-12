/**
 * Verifica que toda tabla public de aplicación tenga RLS habilitado.
 */
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

function findLocalDbContainer() {
  const listed = spawnSync(
    'docker',
    ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'],
    { encoding: 'utf8', cwd: root }
  )
  if (listed.status !== 0) {
    console.error('FAIL: no se pudieron listar contenedores Docker')
    process.exit(1)
  }
  const names = listed.stdout.split(/\r?\n/).map((v) => v.trim()).filter(Boolean)
  if (names.length !== 1) {
    console.error(`FAIL: se esperaba un único Postgres local de Supabase; encontrados=${names.length}`)
    process.exit(1)
  }
  return names[0]
}

const sql = `
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY 1;
`

const psql = spawnSync(
  'docker',
  [
    'exec',
    '-i',
    findLocalDbContainer(),
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-t',
    '-A',
    '-F',
    '|',
  ],
  { input: sql, encoding: 'utf8', cwd: root }
)

if (psql.status !== 0) {
  console.error('FAIL: no se pudo consultar RLS')
  console.error(psql.stderr || psql.stdout)
  process.exit(1)
}

const lines = psql.stdout
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean)

if (lines.length === 0) {
  console.error('FAIL: consulta RLS sin filas')
  process.exit(1)
}

let failed = 0
let checked = 0
for (const line of lines) {
  const [name, flag] = line.split('|')
  if (!name || flag === undefined) continue
  checked++
  const enabled = flag === 't' || flag === 'true'
  if (!enabled) {
    console.error(`FAIL: tabla public.${name} sin RLS`)
    failed++
  } else {
    console.log(`OK: RLS on ${name}`)
  }
}

if (checked === 0) {
  console.error('FAIL: no se parsearon tablas')
  process.exit(1)
}
if (failed > 0) process.exit(1)

console.log(`OK: cobertura RLS en ${checked} tablas public`)
