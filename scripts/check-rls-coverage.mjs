import { cloudDbClient } from './lib/cloud-db-client.mjs'

const client = cloudDbClient()
try {
  await client.connect()
  const { rows } = await client.query(`SELECT c.relname, c.relrowsecurity FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY 1`)
  if (!rows.length || rows.some(row => !row.relrowsecurity)) throw new Error('RLS coverage incomplete')
  console.log(`PASS: RLS enabled on ${rows.length} cloud staging tables`)
} catch (error) {
  console.error(`FAIL: cloud RLS check (${error.code || 'check_failed'})`)
  process.exitCode = 1
} finally { await client.end() }
