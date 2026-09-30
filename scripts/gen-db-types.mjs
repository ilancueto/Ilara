/**
 * Regenera types/database.generated.ts desde Supabase en la nube (staging explícito).
 * Uso: node scripts/gen-db-types.mjs  |  npm run db:types
 */
import { generateCloudTypes } from './lib/cloud-types.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, 'types/database.generated.ts')

mkdirSync(resolve(root, 'types'), { recursive: true })

try {
  const types = generateCloudTypes(root)
  writeFileSync(out, types.replace(/\r\n/g, '\n'), 'utf8')
  console.log(`OK: wrote cloud staging types (${types.length} bytes)`)
} catch (error) { console.error(error.message); process.exitCode = 1 }
