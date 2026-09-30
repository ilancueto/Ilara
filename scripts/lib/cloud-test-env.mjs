import { assertTestSupabaseUrl, PROD_PROJECT_REF } from '../../lib/security/testSupabaseTarget.mjs'

export function cloudTestEnv({ database = false } = {}) {
  const ref = process.env.SUPABASE_TEST_PROJECT_REF?.trim() || ''
  const url = process.env.SUPABASE_TEST_URL?.trim() || ''
  assertTestSupabaseUrl(url)
  const anon = process.env.SUPABASE_TEST_ANON_KEY?.trim() || ''
  const service = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY?.trim() || ''
  if (!anon || !service) throw new Error('Cloud staging API keys are required')
  const dbUrl = process.env.SUPABASE_TEST_DB_URL?.trim() || ''
  if (database) {
    let parsed
    try { parsed = new URL(dbUrl) } catch { throw new Error('Staging database connection is required') }
    const direct = parsed.hostname === `db.${ref}.supabase.co`
    const pooler = parsed.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(parsed.username) === `postgres.${ref}`
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || (!direct && !pooler) || dbUrl.includes(PROD_PROJECT_REF)) {
      throw new Error('Database must belong to the explicitly configured staging project')
    }
  }
  return { ref, url, anon, service, dbUrl }
}
