/** Negative control is transactionally rolled back; never changes the cloud project's policies. */
import assert from 'node:assert/strict'
import { cloudDbClient } from './lib/cloud-db-client.mjs'

const client = cloudDbClient()
try {
  await client.connect()
  await client.query('BEGIN')
  await client.query(`CREATE POLICY stage2_ci_insecure_anon_sales_select ON public.sales FOR SELECT TO anon USING (true)`)
  await client.query('GRANT SELECT ON public.sales TO anon')
  await client.query('SET LOCAL ROLE anon')
  await client.query('SELECT id FROM public.sales LIMIT 1')
  await client.query('ROLLBACK')
  await client.query('BEGIN; SET LOCAL ROLE anon')
  await assert.rejects(client.query('SELECT id FROM public.sales LIMIT 1'), error => error.code === '42501')
  console.log('PASS: temporary insecure policy detected and rolled back; anon access denied again')
} catch (error) {
  console.error(`FAIL: cloud negative control (${error.code || 'check_failed'})`)
  process.exitCode = 1
} finally { await client.query('ROLLBACK').catch(() => {}); await client.end() }
