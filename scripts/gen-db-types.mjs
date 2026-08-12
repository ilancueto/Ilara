/**
 * Regenera types/database.generated.ts desde Supabase local.
 * Uso: node scripts/gen-db-types.mjs  |  npm run db:types
 */
import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, 'types/database.generated.ts')

mkdirSync(resolve(root, 'types'), { recursive: true })

const gen = spawnSync(
  'npx supabase gen types typescript --local --schema public',
  { cwd: root, encoding: 'utf8', shell: true }
)

if (gen.status !== 0) {
  console.error(gen.stderr || gen.stdout || 'supabase gen types failed')
  process.exit(1)
}

writeFileSync(out, gen.stdout.replace(/\r\n/g, '\n'), 'utf8')
console.log(`OK: wrote ${out} (${gen.stdout.length} bytes)`)
