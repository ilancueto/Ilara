/**
 * Prueba de control Stage 2:
 * 1) Inserta temporalmente una policy anónima permisiva en sales (DB local).
 * 2) Verifica que anon puede leer (superficie insegura detectada).
 * 3) Elimina la policy y revoca grant (siempre, en finally).
 *
 * Nunca contra producción.
 */
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const root = resolve(import.meta.dirname, '..')
const PROD = 'qbbnvdmadgomfmrsfxlo'

const url =
  process.env.STAGE2_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'http://127.0.0.1:54321'
const anonKey =
  process.env.STAGE2_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.ANON_KEY ||
  ''

if (url.toLowerCase().includes(PROD)) {
  console.error('FAIL: no ejecutar control negativo contra producción')
  process.exit(1)
}
if (!anonKey) {
  console.error('FAIL: falta anon key')
  process.exit(1)
}

function findLocalDbContainer() {
  const listed = spawnSync(
    'docker',
    [
      'ps',
      '--filter',
      'name=supabase_db_',
      '--filter',
      `label=com.supabase.cli.workdir=${root}`,
      '--format',
      '{{.Names}}',
    ],
    { encoding: 'utf8', cwd: root }
  )
  if (listed.status !== 0) throw new Error('no se pudieron listar contenedores Docker')
  const names = listed.stdout.split(/\r?\n/).map((v) => v.trim()).filter(Boolean)
  if (names.length !== 1) {
    throw new Error(
      `se esperaba el Postgres Supabase de este workspace; encontrados=${names.length}`
    )
  }
  return names[0]
}

function runSql(sql) {
  const r = spawnSync(
    'docker',
    ['exec', '-i', findLocalDbContainer(), 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    { input: sql, encoding: 'utf8', cwd: root }
  )
  return r
}

const drop = `
DROP POLICY IF EXISTS stage2_ci_insecure_anon_sales_select ON public.sales;
`
const create = `
${drop}
CREATE POLICY stage2_ci_insecure_anon_sales_select
  ON public.sales FOR SELECT TO anon USING (true);
GRANT SELECT ON TABLE public.sales TO anon;
`
const cleanup = `
DROP POLICY IF EXISTS stage2_ci_insecure_anon_sales_select ON public.sales;
REVOKE ALL ON TABLE public.sales FROM anon;
`

try {
  const created = runSql(create)
  if (created.status !== 0) {
    console.error('FAIL: no se pudo crear policy de control')
    console.error(created.stderr || created.stdout)
    process.exit(1)
  }
  console.log('OK: policy insegura temporal creada')

  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await anon.from('sales').select('id').limit(1)
  if (error) {
    console.error('FAIL: CI no detectó la policy anónima permisiva (sigue denegada)')
    console.error(error.code || error.message)
    process.exit(1)
  }
  console.log('OK: superficie anónima insegura detectada (control negativo)')
} finally {
  const cleaned = runSql(cleanup)
  if (cleaned.status !== 0) {
    console.error('FAIL: no se pudo limpiar policy de control')
    console.error(cleaned.stderr || cleaned.stdout)
    process.exit(1)
  }
  console.log('OK: policy de control eliminada')
}

const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const verify = await anon.from('sales').select('id').limit(1)
if (!verify.error) {
  console.error('FAIL: sales sigue abierto a anon tras cleanup')
  process.exit(1)
}
console.log('OK: control negativo Stage 2 superado')
process.exit(0)
