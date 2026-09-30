import pg from 'pg'
import { readFileSync } from 'node:fs'
import { cloudTestEnv } from './cloud-test-env.mjs'

export function cloudDbClient() {
  const { dbUrl } = cloudTestEnv({ database: true })
  const parsed = new URL(dbUrl)
  // Supply the vendor CA explicitly; URL SSL flags otherwise replace pg's TLS options.
  for (const name of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) parsed.searchParams.delete(name)
  return new pg.Client({
    connectionString: parsed.toString(), connectionTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: true, ca: readFileSync(new URL('../certs/supabase-root.crt', import.meta.url), 'utf8') },
  })
}
